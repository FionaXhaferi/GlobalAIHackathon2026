import aiosqlite
import json
import uuid
from datetime import datetime
from pathlib import Path

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


def _jaccard(q1: str, q2: str) -> float:
    stopwords = {
        "the", "and", "for", "will", "that", "with", "this", "from", "into",
        "than", "compared", "at", "by", "in", "of", "to", "a", "an", "is",
        "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "do", "does", "did", "not", "but", "or", "nor", "so", "yet",
    }
    def kw(text: str) -> set:
        return {w.strip(".,;:?!()[]") for w in text.lower().split()
                if w not in stopwords and len(w) > 3}
    k1, k2 = kw(q1), kw(q2)
    if not k1 or not k2:
        return 0.0
    return len(k1 & k2) / len(k1 | k2)


async def get_similar_feedback(question: str, limit: int = 3) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50"
        ) as cursor:
            rows = await cursor.fetchall()

    scored = []
    for row in rows:
        score = _jaccard(question, row["question"])
        if score > 0.05:
            scored.append((score, dict(row)))

    scored.sort(key=lambda x: x[0], reverse=True)
    results = []
    for _, row in scored[:limit]:
        results.append({
            "section": row["section"],
            "original_content": row["original_content"],
            "corrected_content": row["corrected_content"],
            "rating": row["rating"],
            "annotations": row["annotations"],
        })
    return results


async def get_all_feedback(limit: int = 20) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM feedback ORDER BY created_at DESC LIMIT ?", (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
    return [dict(r) for r in rows]
