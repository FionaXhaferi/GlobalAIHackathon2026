import aiosqlite
import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import anthropic
from dotenv import load_dotenv

load_dotenv()

DB_PATH = Path(__file__).parent.parent / "feedback.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY,
                question TEXT NOT NULL,
                experiment_tags TEXT NOT NULL,
                section TEXT NOT NULL,
                original_content TEXT NOT NULL,
                corrected_content TEXT NOT NULL,
                rating INTEGER NOT NULL,
                annotations TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
        """)
        await db.commit()

async def save_feedback(
    question: str,
    experiment_tags: list[str],
    section: str,
    original_content,
    corrected_content,
    rating: int,
    annotations: str = "",
) -> str:
    feedback_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO feedback
              (id, question, experiment_tags, section, original_content, corrected_content, rating, annotations, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                feedback_id,
                question,
                json.dumps(experiment_tags),
                section,
                json.dumps(original_content) if not isinstance(original_content, str) else original_content,
                json.dumps(corrected_content) if not isinstance(corrected_content, str) else corrected_content,
                rating,
                annotations,
                now,
            ),
        )
        await db.commit()
    return feedback_id

async def _claude_relevance_scores(question: str, candidates: list[str]) -> dict[str, float]:
    numbered = "\n".join(f"{i + 1}. {q}" for i, q in enumerate(candidates))
    prompt = (
        f'New experiment hypothesis:\n"{question}"\n\n'
        f"Prior experiment questions:\n{numbered}\n\n"
        "Score how relevant each prior experiment's expert feedback would be to the new experiment (0.0–1.0):\n"
        "- 1.0 = same domain, methodology, and subject — feedback directly applies\n"
        "- 0.5 = related domain or overlapping method — feedback may partially apply\n"
        "- 0.0 = completely different domain or method — feedback is irrelevant\n\n"
        'Respond with ONLY a JSON object mapping number to score, e.g. {"1": 0.8, "2": 0.1}'
    )
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    scores_by_index = json.loads(raw)
    return {candidates[int(k) - 1]: float(v) for k, v in scores_by_index.items()}

async def get_similar_feedback(question: str, limit: int = 3) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50"
        ) as cursor:
            rows = await cursor.fetchall()

    if not rows:
        return []

    rows = [dict(r) for r in rows]
    candidates = [r["question"] for r in rows]

    try:
        scores = await _claude_relevance_scores(question, candidates)
    except Exception:
        return []

    scored = [
        (scores.get(r["question"], 0.0), r)
        for r in rows
        if scores.get(r["question"], 0.0) >= 0.6
    ]
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "section": r["section"],
            "original_content": r["original_content"],
            "corrected_content": r["corrected_content"],
            "rating": r["rating"],
            "annotations": r["annotations"],
        }
        for _, r in scored[:limit]
    ]

async def get_all_feedback(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]
