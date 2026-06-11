from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .generator import generate_output
from .image_processor import process_image_to_timeline
from .models import (
    CapabilityResponse,
    CreateLectureRequest,
    CreateLectureResponse,
    GenerateRequest,
    GenerateResponse,
    ImageUploadResponse,
    LectureSummary,
    LectureTimeline,
    VideoUploadResponse,
)
from .retrieval import create_timeline_from_transcript
from .storage import (
    OUTPUTS_DIR,
    UPLOADS_DIR,
    list_saved_timelines,
    load_sample_timeline,
    load_saved_timeline,
    save_timeline,
)
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


@app.get("/api/lectures", response_model=list[LectureSummary])
def list_lectures(limit: int = 20) -> list[LectureSummary]:
    return list_saved_timelines(limit=max(1, min(limit, 100)))


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
    transcript_file: UploadFile | None = File(None),
) -> VideoUploadResponse:
    if not video.filename:
        raise HTTPException(status_code=400, detail="Video file is required.")

    upload_path = await save_upload_file(
        upload=video,
        allowed_suffixes=VIDEO_SUFFIXES,
        default_stem="uploaded_video",
        max_bytes=MAX_VIDEO_UPLOAD_BYTES,
        kind="video",
    )

    transcript_text = transcript.strip()
    if transcript_file and transcript_file.filename:
        transcript_file_text = await read_text_upload(transcript_file)
        transcript_text = "\n\n".join(part for part in [transcript_text, transcript_file_text] if part)

    result = process_video_to_timeline(
        title=title,
        video_path=upload_path,
        outputs_dir=OUTPUTS_DIR,
        transcript_hint=transcript_text,
    )
    save_timeline(result.timeline)
    return VideoUploadResponse(
        lecture_id=result.timeline.lecture_id,
        frame_count=result.frame_count,
        ocr_frame_count=result.ocr_frame_count,
        ocr_engine=result.ocr_engine,
        warnings=result.warnings,
    )


@app.post("/api/images/upload", response_model=ImageUploadResponse)
async def upload_image(
    title: str = Form("Uploaded Slide Image"),
    notes: str = Form(""),
    image: UploadFile = File(...),
) -> ImageUploadResponse:
    if not image.filename:
        raise HTTPException(status_code=400, detail="Image file is required.")

    upload_path = await save_upload_file(
        upload=image,
        allowed_suffixes=IMAGE_SUFFIXES,
        default_stem="uploaded_image",
        max_bytes=MAX_IMAGE_UPLOAD_BYTES,
        kind="image",
    )

    result = process_image_to_timeline(
        title=title,
        image_path=upload_path,
        outputs_dir=OUTPUTS_DIR,
        notes_hint=notes,
    )
    save_timeline(result.timeline)
    return ImageUploadResponse(
        lecture_id=result.timeline.lecture_id,
        ocr_text_count=result.ocr_text_count,
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


async def save_upload_file(
    upload: UploadFile,
    allowed_suffixes: set[str],
    default_stem: str,
    max_bytes: int,
    kind: str,
) -> Path:
    if not upload.filename:
        raise HTTPException(status_code=400, detail=f"{kind.capitalize()} file is required.")

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = safe_filename(upload.filename, allowed_suffixes, default_stem)
    upload_path = UPLOADS_DIR / safe_name
    bytes_written = 0
    with upload_path.open("wb") as buffer:
        while chunk := await upload.read(1024 * 1024):
            bytes_written += len(chunk)
            if bytes_written > max_bytes:
                buffer.close()
                upload_path.unlink(missing_ok=True)
                max_mb = max_bytes // (1024 * 1024)
                raise HTTPException(status_code=413, detail=f"{kind.capitalize()} file is too large. Maximum is {max_mb} MB.")
            buffer.write(chunk)
    if bytes_written == 0:
        upload_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"{kind.capitalize()} file is empty.")
    return upload_path


async def read_text_upload(upload: UploadFile) -> str:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in TRANSCRIPT_SUFFIXES:
        raise HTTPException(status_code=400, detail="Caption/transcript file must be TXT, SRT, or VTT.")
    content = await upload.read(MAX_TRANSCRIPT_UPLOAD_BYTES + 1)
    if len(content) > MAX_TRANSCRIPT_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Caption/transcript file is too large. Maximum is 2 MB.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("utf-8", errors="replace")
    return clean_caption_text(text)


def clean_caption_text(text: str) -> str:
    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.upper() == "WEBVTT" or line.isdigit():
            continue
        if "-->" in line:
            continue
        line = re.sub(r"<[^>]+>", "", line)
        line = re.sub(r"\{[^}]+\}", "", line)
        if line:
            lines.append(line)
    return " ".join(lines).strip()


def safe_filename(filename: str, allowed_suffixes: set[str], default_stem: str) -> str:
    source = Path(filename).name
    stem = safe_path_part(Path(source).stem) or default_stem
    suffix = Path(source).suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix or 'none'}.")
    return f"{stem}_{uuid.uuid4().hex[:8]}{suffix}"


def safe_path_part(value: str) -> str:
    return "".join(char for char in value if char.isalnum() or char in {"_", "-", "."})


VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
TRANSCRIPT_SUFFIXES = {".txt", ".srt", ".vtt"}
MAX_VIDEO_UPLOAD_BYTES = 750 * 1024 * 1024
MAX_IMAGE_UPLOAD_BYTES = 35 * 1024 * 1024
MAX_TRANSCRIPT_UPLOAD_BYTES = 2 * 1024 * 1024
