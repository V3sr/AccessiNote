from __future__ import annotations

import hashlib
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .models import LectureTimeline, SourceInfo, TimelineChunk
from .retrieval import extract_concepts, format_timestamp, normalize_whitespace, split_transcript


FRAME_INTERVAL_SECONDS = 30
MAX_FRAMES = 10


@dataclass
class VideoProcessingResult:
    timeline: LectureTimeline
    warnings: list[str]
    frame_count: int
    ocr_engine: str


def build_capability_notes() -> list[str]:
    notes = []
    if not ffmpeg_available():
        notes.append("ffmpeg is unavailable. Reinstall backend requirements or install ffmpeg to extract keyframes.")
    if not tesseract_available():
        notes.append("Tesseract OCR is not on PATH, so extracted frames will not be OCR-scanned yet.")
    if not notes:
        notes.append("Local video keyframe extraction and OCR are available.")
    return notes


def ffmpeg_available() -> bool:
    return find_ffmpeg() is not None


def find_ffmpeg() -> str | None:
    path_match = shutil.which("ffmpeg")
    if path_match:
        return path_match

    try:
        import imageio_ffmpeg
    except ImportError:
        return None

    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except RuntimeError:
        return None


def tesseract_available() -> bool:
    return find_tesseract() is not None


def find_tesseract() -> str | None:
    path_match = shutil.which("tesseract")
    if path_match:
        return path_match

    common_paths = [
        Path("C:/Program Files/Tesseract-OCR/tesseract.exe"),
        Path("C:/Program Files (x86)/Tesseract-OCR/tesseract.exe"),
    ]
    for path in common_paths:
        if path.exists():
            return str(path)
    return None


def process_video_to_timeline(
    title: str,
    video_path: Path,
    outputs_dir: Path,
    transcript_hint: str = "",
) -> VideoProcessingResult:
    clean_title = title.strip() or video_path.stem or "Uploaded Video Lecture"
    lecture_id = make_lecture_id(clean_title, video_path)
    frames_dir = outputs_dir / f"{lecture_id}_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    transcript_chunks = split_transcript(normalize_whitespace(transcript_hint)) if transcript_hint.strip() else []

    ffmpeg_path = find_ffmpeg()
    if not ffmpeg_path:
        warnings.append("ffmpeg is unavailable. Video frames were not extracted.")
        timeline = placeholder_timeline(
            lecture_id=lecture_id,
            title=clean_title,
            video_path=video_path,
            transcript_chunks=transcript_chunks,
            ocr_message="ffmpeg not available; OCR scan could not run.",
            visual_message=(
                "The video was saved locally, but AccessiNote could not inspect frames because "
                "ffmpeg is not available on PATH."
            ),
            confidence=0.35,
        )
        return VideoProcessingResult(timeline=timeline, warnings=warnings, frame_count=0, ocr_engine="none")

    frame_paths = extract_keyframes(video_path, frames_dir, ffmpeg_path)
    if not frame_paths:
        warnings.append("ffmpeg ran, but no keyframes were extracted from the uploaded video.")
        timeline = placeholder_timeline(
            lecture_id=lecture_id,
            title=clean_title,
            video_path=video_path,
            transcript_chunks=transcript_chunks,
            ocr_message="No keyframes were available for OCR scanning.",
            visual_message="No video frames were extracted. Confirm the file is a readable video.",
            confidence=0.4,
        )
        return VideoProcessingResult(timeline=timeline, warnings=warnings, frame_count=0, ocr_engine="none")

    tesseract_path = find_tesseract()
    if not tesseract_path:
        warnings.append("Tesseract OCR is not installed or not on PATH. Keyframes were extracted without OCR text.")

    chunks = []
    for index, frame_path in enumerate(frame_paths, start=1):
        start_seconds = (index - 1) * FRAME_INTERVAL_SECONDS
        ocr_text = run_tesseract(frame_path, tesseract_path) if tesseract_path else ""
        transcript_text = transcript_for_frame(transcript_chunks, index, len(frame_paths))
        transcript = transcript_text or (
            "Video keyframe extracted locally. No audio transcription provider is configured, "
            "so transcript text is not available for this timestamp."
        )
        ocr_items = [ocr_text] if ocr_text else ["No OCR text detected or OCR engine unavailable for this frame."]
        concepts = extract_concepts(" ".join([transcript, ocr_text]))[:5]
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(start_seconds),
                end=format_timestamp(start_seconds + FRAME_INTERVAL_SECONDS),
                transcript=transcript,
                ocr=ocr_items,
                visual_description=(
                    f"Keyframe extracted from the uploaded video around {format_timestamp(start_seconds)}. "
                    "Use this frame as local visual evidence; human review is still required."
                ),
                concepts=concepts,
                source_confidence=0.68 if ocr_text else 0.52,
                keyframe_path=f"/api/lectures/{lecture_id}/frames/{frame_path.name}",
            )
        )

    timeline = LectureTimeline(
        lecture_id=lecture_id,
        title=clean_title,
        source=SourceInfo(
            type="video",
            attribution=f"Local video upload: {video_path.name}",
            license="User-provided permitted material",
            url="",
        ),
        chunks=chunks,
    )
    return VideoProcessingResult(
        timeline=timeline,
        warnings=warnings,
        frame_count=len(frame_paths),
        ocr_engine="tesseract" if tesseract_path else "none",
    )


def extract_keyframes(video_path: Path, frames_dir: Path, ffmpeg_path: str) -> list[Path]:
    for existing in frames_dir.glob("frame_*.jpg"):
        existing.unlink(missing_ok=True)

    first_frame = frames_dir / "frame_0001.jpg"
    first_frame_command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(video_path),
        "-frames:v",
        "1",
        str(first_frame),
    ]
    try:
        subprocess.run(first_frame_command, check=True, capture_output=True, text=True, timeout=60)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return []

    output_pattern = frames_dir / "frame_%04d.jpg"
    interval_command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(video_path),
        "-vf",
        f"fps=1/{FRAME_INTERVAL_SECONDS}",
        "-start_number",
        "2",
        "-frames:v",
        str(MAX_FRAMES - 1),
        str(output_pattern),
    ]
    try:
        subprocess.run(interval_command, check=True, capture_output=True, text=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        pass

    return sorted(frames_dir.glob("frame_*.jpg"))


def run_tesseract(frame_path: Path, tesseract_path: str | None) -> str:
    if not tesseract_path:
        return ""
    command = [tesseract_path, str(frame_path), "stdout", "--psm", "6"]
    try:
        completed = subprocess.run(command, check=True, capture_output=True, text=True, timeout=30)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return ""
    return normalize_whitespace(completed.stdout)


def placeholder_timeline(
    lecture_id: str,
    title: str,
    video_path: Path,
    transcript_chunks: list[str],
    ocr_message: str,
    visual_message: str,
    confidence: float,
) -> LectureTimeline:
    chunks = []
    source_chunks = transcript_chunks or [
        "Video uploaded locally. No transcript was provided and local video scanning tools are not available yet."
    ]
    for index, text in enumerate(source_chunks, start=1):
        start_seconds = (index - 1) * FRAME_INTERVAL_SECONDS
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(start_seconds),
                end=format_timestamp(start_seconds + FRAME_INTERVAL_SECONDS),
                transcript=text,
                ocr=[ocr_message],
                visual_description=visual_message,
                concepts=extract_concepts(text),
                source_confidence=confidence,
                keyframe_path="",
            )
        )

    return LectureTimeline(
        lecture_id=lecture_id,
        title=title,
        source=SourceInfo(
            type="video",
            attribution=f"Local video upload: {video_path.name}",
            license="User-provided permitted material",
            url="",
        ),
        chunks=chunks,
    )


def transcript_for_frame(transcript_chunks: list[str], frame_index: int, frame_count: int) -> str:
    if not transcript_chunks:
        return ""
    if len(transcript_chunks) == frame_count:
        return transcript_chunks[frame_index - 1]
    mapped_index = min(len(transcript_chunks) - 1, int((frame_index - 1) * len(transcript_chunks) / frame_count))
    return transcript_chunks[mapped_index]


def make_lecture_id(title: str, video_path: Path) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    seed_source = f"{title}:{video_path.name}:{video_path.stat().st_size}"
    seed = hashlib.sha1(seed_source.encode("utf-8")).hexdigest()[:8]
    return f"lecture_video_{timestamp}_{seed}"
