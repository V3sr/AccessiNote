from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .generator import generate_output
from .models import (
    CapabilityResponse,
    CreateLectureRequest,
    CreateLectureResponse,
    GenerateRequest,
    GenerateResponse,
    LectureTimeline,
    VideoUploadResponse,
)
from .retrieval import create_timeline_from_transcript
from .storage import OUTPUTS_DIR, UPLOADS_DIR, load_sample_timeline, load_saved_timeline, save_timeline
from .video_processor import (
    build_capability_notes,
    ffmpeg_available,
    process_video_to_timeline,
    rapidocr_available,
    tesseract_available,
)


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


@app.get("/api/capabilities", response_model=CapabilityResponse)
def get_capabilities() -> CapabilityResponse:
    ocr_engines = []
    if rapidocr_available():
        ocr_engines.append("rapidocr")
    if tesseract_available():
        ocr_engines.append("tesseract")

    return CapabilityResponse(
        ffmpeg_available=ffmpeg_available(),
        rapidocr_available=rapidocr_available(),
        tesseract_available=tesseract_available(),
        ocr_engines=ocr_engines,
        notes=build_capability_notes(),
    )


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


@app.post("/api/videos/upload", response_model=VideoUploadResponse)
async def upload_video(
    title: str = Form("Uploaded Video Lecture"),
    transcript: str = Form(""),
    video: UploadFile = File(...),
) -> VideoUploadResponse:
    if not video.filename:
        raise HTTPException(status_code=400, detail="Video file is required.")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = safe_filename(video.filename)
    upload_path = UPLOADS_DIR / safe_name
    with upload_path.open("wb") as buffer:
        while chunk := await video.read(1024 * 1024):
            buffer.write(chunk)

    result = process_video_to_timeline(
        title=title,
        video_path=upload_path,
        outputs_dir=OUTPUTS_DIR,
        transcript_hint=transcript,
    )
    save_timeline(result.timeline)
    return VideoUploadResponse(
        lecture_id=result.timeline.lecture_id,
        frame_count=result.frame_count,
        ocr_frame_count=result.ocr_frame_count,
        ocr_engine=result.ocr_engine,
        warnings=result.warnings,
    )


@app.get("/api/lectures/{lecture_id}/frames/{filename}")
def get_lecture_frame(lecture_id: str, filename: str) -> FileResponse:
    safe_id = safe_path_part(lecture_id)
    safe_frame = safe_path_part(filename)
    frame_path = OUTPUTS_DIR / f"{safe_id}_frames" / safe_frame
    if not frame_path.exists() or not frame_path.is_file():
        raise HTTPException(status_code=404, detail="Frame not found.")
    return FileResponse(frame_path)


def safe_filename(filename: str) -> str:
    source = Path(filename).name
    stem = safe_path_part(Path(source).stem) or "uploaded_video"
    suffix = Path(source).suffix.lower()
    if suffix not in {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}:
        suffix = ".bin"
    return f"{stem}{suffix}"


def safe_path_part(value: str) -> str:
    return "".join(char for char in value if char.isalnum() or char in {"_", "-", "."})
