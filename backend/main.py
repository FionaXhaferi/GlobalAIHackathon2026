import asyncio
import json
import os
import socket
from contextlib import asynccontextmanager
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel

from services.feedback_store import init_db, save_feedback, get_similar_feedback, get_all_feedback
from services.literature_qc import check_literature
from services.experiment_planner import generate_plan_stream
from services.plan_scorer import score_plan

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AI Scientist API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # open for local network access (phones/tablets on same WiFi)
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _local_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# ── Request / Response models ────────────────────────────────────────────────

class LiteratureRequest(BaseModel):
    question: str


class GeneratePlanRequest(BaseModel):
    question: str
    literature_context: dict = {}


class FeedbackRequest(BaseModel):
    question: str
    experiment_tags: list[str] = []
    section: str
    original_content: Any
    corrected_content: Any
    rating: int
    annotations: str = ""


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/api/network-info")
async def network_info():
    ip = _local_ip()
    return {"ip": ip, "passport_base_url": f"http://{ip}:8000/passport"}


def _load_passport_html() -> str:
    # Local dev: passport.html is in frontend/public relative to backend/
    local_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "passport.html")
    if os.path.exists(local_path):
        return open(local_path, encoding="utf-8").read()
    # Render/production: embed inline (file not present in deployed backend dir)
    return open(os.path.join(os.path.dirname(__file__), "passport.html"), encoding="utf-8").read()

try:
    PASSPORT_HTML = _load_passport_html()
except FileNotFoundError:
    PASSPORT_HTML = "<h1>Passport viewer not available</h1>"


@app.get("/passport", response_class=HTMLResponse)
async def passport_viewer():
    return HTMLResponse(content=PASSPORT_HTML)


@app.get("/api/health")
async def health():
    api_key_set = bool(os.getenv("ANTHROPIC_API_KEY") and
                       os.getenv("ANTHROPIC_API_KEY") != "your-api-key-here")
    return {"status": "ok", "api_key_configured": api_key_set}


@app.post("/api/literature-qc")
async def literature_qc(request: LiteratureRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        result = await check_literature(request.question)
    except RuntimeError as exc:
        raise HTTPException(status_code=402, detail=str(exc))
    return result


@app.post("/api/generate-plan/stream")
async def generate_plan(request: GeneratePlanRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your-api-key-here":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY not configured. Add it to backend/.env"
        )

    feedback = await get_similar_feedback(request.question, limit=3)

    async def event_generator():
        try:
            async for event in generate_plan_stream(
                request.question,
                request.literature_context,
                feedback,
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class ScorePlanRequest(BaseModel):
    question: str
    plan: dict


@app.post("/api/score-plan")
async def score_plan_endpoint(request: ScorePlanRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    try:
        result = await asyncio.to_thread(score_plan, request.question, request.plan)
        return result
    except Exception as exc:
        msg = str(exc)
        if "credit balance is too low" in msg or "billing" in msg.lower():
            raise HTTPException(status_code=402, detail="Anthropic API account has no credits.")
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/feedback")
async def submit_feedback(request: FeedbackRequest):
    if request.rating < 1 or request.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be 1-5")
    feedback_id = await save_feedback(
        question=request.question,
        experiment_tags=request.experiment_tags,
        section=request.section,
        original_content=request.original_content,
        corrected_content=request.corrected_content,
        rating=request.rating,
        annotations=request.annotations,
    )
    return {"id": feedback_id, "success": True}


@app.get("/api/feedback")
async def list_feedback():
    items = await get_all_feedback(limit=50)
    return {"feedback": items, "count": len(items)}
