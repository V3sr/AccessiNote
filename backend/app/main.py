from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from queue import Queue
from threading import Lock, Thread
import uuid

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
    ProcessingJob,
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
    faster_whisper_available,
    ffmpeg_available,
    process_video_to_timeline,
    rapidocr_available,
    tesseract_available,
)


app = FastAPI(title="AccessiNote Local MVP", version="0.1.0")
MEDIA_JOBS: dict[str, ProcessingJob] = {}
MEDIA_JOB_PAYLOADS: dict[str, "MediaJobPayload"] = {}
MEDIA_JOB_QUEUE: Queue[str] = Queue()
MEDIA_JOB_LOCK = Lock()
MEDIA_JOB_WORKER_STARTED = False
ACTIVE_JOB_STATUSES = {"queued", "running"}
TERMINAL_JOB_STATUSES = {"complete", "failed", "canceled"}


@dataclass
class MediaJobPayload:
    job_id: str
    kind: str
    title: str
    upload_path: Path
    transcript_text: str


class JobCanceled(Exception):
    pass


class JobStopped(Exception):
    pass

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
        local_transcription_available=faster_whisper_available(),
        transcription_engine="faster-whisper" if faster_whisper_available() else "none",
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
        candidate_frame_count=result.candidate_frame_count,
        ocr_frame_count=result.ocr_frame_count,
        ocr_engine=result.ocr_engine,
        transcript_segment_count=result.transcript_segment_count,
        transcription_engine=result.transcription_engine,
        metrics=result.metrics,
        warnings=result.warnings,
    )


@app.post("/api/jobs/media", response_model=ProcessingJob)
async def create_media_job(
    kind: str = Form("video"),
    title: str = Form("Uploaded Lecture Material"),
    transcript: str = Form(""),
    video: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    transcript_file: UploadFile | None = File(None),
) -> ProcessingJob:
    normalized_kind = kind.strip().lower()
    if normalized_kind not in {"video", "image"}:
        raise HTTPException(status_code=400, detail="Media job kind must be video or image.")

    if normalized_kind == "video":
        if video is None or not video.filename:
            raise HTTPException(status_code=400, detail="Video file is required.")
        upload_path = await save_upload_file(
            upload=video,
            allowed_suffixes=VIDEO_SUFFIXES,
            default_stem="uploaded_video",
            max_bytes=MAX_VIDEO_UPLOAD_BYTES,
            kind="video",
        )
    else:
        if image is None or not image.filename:
            raise HTTPException(status_code=400, detail="Image file is required.")
        upload_path = await save_upload_file(
            upload=image,
            allowed_suffixes=IMAGE_SUFFIXES,
            default_stem="uploaded_image",
            max_bytes=MAX_IMAGE_UPLOAD_BYTES,
            kind="image",
        )

    transcript_text = transcript.strip()
    if transcript_file and transcript_file.filename:
        transcript_file_text = await read_text_upload(transcript_file)
        transcript_text = "\n\n".join(part for part in [transcript_text, transcript_file_text] if part)

    job = ProcessingJob(
        job_id=f"job_{uuid.uuid4().hex[:10]}",
        kind=normalized_kind,
        status="queued",
        stage="queued",
        progress=5,
        created_at=current_timestamp(),
        updated_at=current_timestamp(),
    )
    payload = MediaJobPayload(
        job_id=job.job_id,
        kind=normalized_kind,
        title=title,
        upload_path=upload_path,
        transcript_text=transcript_text,
    )
    with MEDIA_JOB_LOCK:
        MEDIA_JOBS[job.job_id] = job
        MEDIA_JOB_PAYLOADS[job.job_id] = payload
        MEDIA_JOB_QUEUE.put(job.job_id)
    ensure_media_job_worker_started()
    return job


@app.get("/api/jobs", response_model=list[ProcessingJob])
def list_media_jobs(active: bool = False, limit: int = 20) -> list[ProcessingJob]:
    refresh_stale_jobs()
    with MEDIA_JOB_LOCK:
        jobs = list(MEDIA_JOBS.values())
    if active:
        jobs = [job for job in jobs if job.status in {"queued", "running"}]
    jobs.sort(key=lambda item: item.updated_at or item.created_at, reverse=True)
    return jobs[: max(1, min(limit, 100))]


@app.get("/api/jobs/{job_id}", response_model=ProcessingJob)
def get_media_job(job_id: str) -> ProcessingJob:
    refresh_stale_jobs()
    with MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found.")
    return job


@app.post("/api/jobs/{job_id}/cancel", response_model=ProcessingJob)
def cancel_media_job(job_id: str) -> ProcessingJob:
    refresh_stale_jobs()
    with MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Processing job not found.")
    if job.status in {"complete", "failed", "canceled"}:
        return job
    update_job(
        job_id,
        status="canceled",
        stage="canceled",
        progress=100,
        error="Processing canceled. If a native transcription step was already running, it may finish in the background before the local queue accepts the next job.",
        cancel_requested=True,
    )
    return get_media_job(job_id)


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


def ensure_media_job_worker_started() -> None:
    global MEDIA_JOB_WORKER_STARTED

    with MEDIA_JOB_LOCK:
        if MEDIA_JOB_WORKER_STARTED:
            return
        MEDIA_JOB_WORKER_STARTED = True

    worker = Thread(target=media_job_worker, name="accessinote-media-worker", daemon=True)
    worker.start()


def media_job_worker() -> None:
    while True:
        job_id = MEDIA_JOB_QUEUE.get()
        try:
            with MEDIA_JOB_LOCK:
                payload = MEDIA_JOB_PAYLOADS.get(job_id)
                job = MEDIA_JOBS.get(job_id)
            if payload is None or job is None:
                continue
            if job.cancel_requested or job.status == "canceled":
                update_job(job_id, status="canceled", stage="canceled", progress=100)
                continue

            run_media_job(payload)
        finally:
            with MEDIA_JOB_LOCK:
                job = MEDIA_JOBS.get(job_id)
                if job and job.status in TERMINAL_JOB_STATUSES:
                    MEDIA_JOB_PAYLOADS.pop(job_id, None)
            MEDIA_JOB_QUEUE.task_done()


def run_media_job(payload: MediaJobPayload) -> None:
    update_job(payload.job_id, status="running", stage="starting", progress=8)
    try:
        ensure_job_can_continue(payload.job_id)

        if payload.kind == "video":
            result = process_video_to_timeline(
                title=payload.title,
                video_path=payload.upload_path,
                outputs_dir=OUTPUTS_DIR,
                transcript_hint=payload.transcript_text,
                stage_callback=lambda stage, progress: update_job_checked(payload.job_id, stage, progress),
            )
            ensure_job_can_continue(payload.job_id)
            save_timeline(result.timeline)
            update_job(
                payload.job_id,
                status="complete",
                stage="ready for review",
                progress=100,
                lecture_id=result.timeline.lecture_id,
                warnings=result.warnings,
                metrics=result.metrics,
            )
            return

        update_job_checked(payload.job_id, "running OCR", 55)
        image_result = process_image_to_timeline(
            title=payload.title,
            image_path=payload.upload_path,
            outputs_dir=OUTPUTS_DIR,
            notes_hint=payload.transcript_text,
        )
        ensure_job_can_continue(payload.job_id)
        save_timeline(image_result.timeline)
        update_job(
            payload.job_id,
            status="complete",
            stage="ready for review",
            progress=100,
            lecture_id=image_result.timeline.lecture_id,
            warnings=image_result.warnings,
            metrics=image_result.timeline.processing_metadata.metrics,
        )
    except JobCanceled:
        update_job(
            payload.job_id,
            status="canceled",
            stage="canceled",
            progress=100,
            error="Processing canceled.",
            cancel_requested=True,
        )
    except JobStopped:
        return
    except Exception as error:
        update_job(payload.job_id, status="failed", stage="failed", progress=100, error=str(error))


def update_job_checked(job_id: str, stage: str, progress: int) -> None:
    ensure_job_can_continue(job_id)
    update_job(job_id, status="running", stage=stage, progress=progress)


def ensure_job_can_continue(job_id: str) -> None:
    if is_job_cancel_requested(job_id):
        raise JobCanceled()
    if not is_job_active(job_id):
        raise JobStopped()


def is_job_cancel_requested(job_id: str) -> bool:
    with MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
        return bool(job and (job.cancel_requested or job.status == "canceled"))


def is_job_active(job_id: str) -> bool:
    with MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
        return bool(job and job.status in ACTIVE_JOB_STATUSES)


def refresh_stale_jobs() -> None:
    stale_after = job_stale_seconds()
    now = datetime.now(timezone.utc)
    with MEDIA_JOB_LOCK:
        jobs = list(MEDIA_JOBS.values())

    for job in jobs:
        if job.status != "running" or not job.updated_at:
            continue
        try:
            updated_at = datetime.fromisoformat(job.updated_at)
        except ValueError:
            continue
        if (now - updated_at).total_seconds() > stale_after:
            update_job(
                job.job_id,
                status="failed",
                stage="failed",
                progress=100,
                error=(
                    f"Processing stalled for more than {stale_after} seconds at {job.stage}. "
                    "Try again with uploaded captions or increase ACCESSINOTE_TRANSCRIPTION_TIMEOUT_SECONDS."
                ),
            )


def job_stale_seconds() -> int:
    raw_value = os.getenv("ACCESSINOTE_JOB_STALE_SECONDS", "900").strip()
    try:
        value = int(raw_value)
    except ValueError:
        value = 900
    return max(60, min(value, 7200))


def update_job(
    job_id: str,
    status: str | None = None,
    stage: str | None = None,
    progress: int | None = None,
    lecture_id: str | None = None,
    warnings: list[str] | None = None,
    metrics=None,
    error: str | None = None,
    cancel_requested: bool | None = None,
) -> None:
    with MEDIA_JOB_LOCK:
        job = MEDIA_JOBS.get(job_id)
        if job is None:
            return
        if job.status in TERMINAL_JOB_STATUSES and status != job.status:
            return
        updates = {}
        if status is not None:
            updates["status"] = status
        if stage is not None:
            updates["stage"] = stage
        if progress is not None:
            updates["progress"] = max(0, min(100, progress))
        if lecture_id is not None:
            updates["lecture_id"] = lecture_id
        if warnings is not None:
            updates["warnings"] = warnings
        if metrics is not None:
            updates["metrics"] = metrics
        if error is not None:
            updates["error"] = error
        if cancel_requested is not None:
            updates["cancel_requested"] = cancel_requested
        updates["updated_at"] = current_timestamp()
        MEDIA_JOBS[job_id] = job.model_copy(update=updates)


def current_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


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
    return text


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
