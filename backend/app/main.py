from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .generator import generate_output
from .models import (
    CreateLectureRequest,
    CreateLectureResponse,
    GenerateRequest,
    GenerateResponse,
    LectureTimeline,
)
from .retrieval import create_timeline_from_transcript
from .storage import load_sample_timeline, load_saved_timeline, save_timeline


app = FastAPI(title="AccessiNote Local MVP", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/lectures/sample", response_model=LectureTimeline)
def get_sample_lecture() -> LectureTimeline:
    return load_sample_timeline()


@app.post("/api/lectures", response_model=CreateLectureResponse)
def create_lecture(request: CreateLectureRequest) -> CreateLectureResponse:
    if request.source_type != "transcript":
        raise HTTPException(status_code=400, detail="Only transcript source_type is supported locally.")
    if not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript cannot be empty.")

    timeline = create_timeline_from_transcript(request.title, request.transcript)
    save_timeline(timeline)
    return CreateLectureResponse(lecture_id=timeline.lecture_id)


@app.get("/api/lectures/{lecture_id}", response_model=LectureTimeline)
def get_lecture(lecture_id: str) -> LectureTimeline:
    if lecture_id == "sample" or lecture_id == "sample_synthetic_linear_algebra":
        return load_sample_timeline()

    timeline = load_saved_timeline(lecture_id)
    if timeline is None:
        raise HTTPException(status_code=404, detail="Lecture not found.")
    return timeline


@app.post("/api/lectures/{lecture_id}/generate", response_model=GenerateResponse)
def generate_lecture_output(lecture_id: str, request: GenerateRequest) -> GenerateResponse:
    timeline = get_lecture(lecture_id)
    return generate_output(timeline, request.mode)
