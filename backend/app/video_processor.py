from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
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
    ocr_frame_count: int
    ocr_engine: str


@dataclass
class ExtractedFrame:
    path: Path
    start_seconds: int


@dataclass
class OcrResult:
    lines: list[str]
    confidence: float
    engine: str


def build_capability_notes() -> list[str]:
    notes = []
    if not ffmpeg_available():
        notes.append("ffmpeg is unavailable. Reinstall backend requirements or install ffmpeg to extract keyframes.")
    if rapidocr_available():
        notes.append("RapidOCR is available for offline frame text detection.")
    elif tesseract_available():
        notes.append("Tesseract OCR is available for local frame text detection.")
    else:
        notes.append("No OCR engine is available. Install backend requirements or Tesseract to scan frame text.")
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


def rapidocr_available() -> bool:
    try:
        import rapidocr  # noqa: F401
    except ImportError:
        return False
    return True


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


@lru_cache(maxsize=1)
def get_rapidocr_engine():
    from rapidocr import RapidOCR

    return RapidOCR()


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
        return VideoProcessingResult(
            timeline=timeline,
            warnings=warnings,
            frame_count=0,
            ocr_frame_count=0,
            ocr_engine="none",
        )

    frames = extract_keyframes(video_path, frames_dir, ffmpeg_path)
    if not frames:
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
        return VideoProcessingResult(
            timeline=timeline,
            warnings=warnings,
            frame_count=0,
            ocr_frame_count=0,
            ocr_engine="none",
        )

    has_rapidocr = rapidocr_available()
    tesseract_path = find_tesseract()
    if not has_rapidocr and not tesseract_path:
        warnings.append("No local OCR engine is available. Keyframes were extracted without OCR text.")

    chunks = []
    used_engines: set[str] = set()
    ocr_frame_count = 0
    for index, frame in enumerate(frames, start=1):
        start_seconds = frame.start_seconds
        ocr_result = run_local_ocr(frame.path, tesseract_path=tesseract_path, prefer_rapidocr=has_rapidocr)
        if ocr_result.engine != "none":
            used_engines.add(ocr_result.engine)
        if ocr_result.lines:
            ocr_frame_count += 1

        transcript_text = transcript_for_frame(transcript_chunks, index, len(frames))
        transcript = transcript_text or (
            "Video keyframe extracted locally. No audio transcription provider is configured, "
            "so transcript text is not available for this timestamp."
        )
        ocr_items = ocr_result.lines or [ocr_status_message(ocr_result.engine)]
        concepts = extract_concepts(" ".join([transcript, " ".join(ocr_result.lines)]))[:5]
        source_confidence = source_confidence_for(transcript_text, ocr_result)
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(start_seconds),
                end=format_timestamp(start_seconds + FRAME_INTERVAL_SECONDS),
                transcript=transcript,
                ocr=ocr_items,
                ocr_confidence=ocr_result.confidence,
                visual_description=(
                    visual_description_for_frame(start_seconds, ocr_result)
                ),
                concepts=concepts,
                source_confidence=source_confidence,
                keyframe_path=f"/api/lectures/{lecture_id}/frames/{frame.path.name}",
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
        frame_count=len(frames),
        ocr_frame_count=ocr_frame_count,
        ocr_engine=primary_engine_name(used_engines, has_rapidocr, tesseract_path),
    )


def extract_keyframes(video_path: Path, frames_dir: Path, ffmpeg_path: str) -> list[ExtractedFrame]:
    for existing in frames_dir.glob("frame_*.jpg"):
        existing.unlink(missing_ok=True)

    sample_points = sample_seconds(parse_video_duration(video_path, ffmpeg_path))
    frames: list[ExtractedFrame] = []
    for index, start_seconds in enumerate(sample_points, start=1):
        frame_path = frames_dir / f"frame_{index:04d}.jpg"
        command = [
            ffmpeg_path,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            str(start_seconds),
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-q:v",
            "2",
            str(frame_path),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, text=True, timeout=45)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            continue
        if frame_path.exists() and frame_path.stat().st_size > 0:
            frames.append(ExtractedFrame(path=frame_path, start_seconds=start_seconds))

    return frames


def parse_video_duration(video_path: Path, ffmpeg_path: str) -> int | None:
    command = [ffmpeg_path, "-hide_banner", "-i", str(video_path)]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        return None

    output = f"{completed.stderr}\n{completed.stdout}"
    match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", output)
    if not match:
        return None
    hours, minutes, seconds = match.groups()
    duration = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    return max(1, int(duration))


def sample_seconds(duration_seconds: int | None) -> list[int]:
    if duration_seconds is None:
        return [index * FRAME_INTERVAL_SECONDS for index in range(MAX_FRAMES)]
    points = list(range(0, duration_seconds + 1, FRAME_INTERVAL_SECONDS))
    if not points:
        points = [0]
    return points[:MAX_FRAMES]


def run_local_ocr(frame_path: Path, tesseract_path: str | None, prefer_rapidocr: bool) -> OcrResult:
    if prefer_rapidocr:
        rapid_result = run_rapidocr(frame_path)
        if rapid_result.lines:
            return rapid_result
        if rapid_result.engine == "rapidocr" and not tesseract_path:
            return rapid_result

    tesseract_result = run_tesseract(frame_path, tesseract_path)
    if tesseract_result.lines:
        return tesseract_result

    return OcrResult(lines=[], confidence=0.0, engine="rapidocr" if prefer_rapidocr else "none")


def run_rapidocr(frame_path: Path) -> OcrResult:
    try:
        result = get_rapidocr_engine()(str(frame_path))
    except Exception:
        return OcrResult(lines=[], confidence=0.0, engine="none")

    texts = list(getattr(result, "txts", None) or [])
    scores = list(getattr(result, "scores", None) or [])
    accepted_lines = []
    accepted_scores = []
    for index, text in enumerate(texts):
        clean_text = normalize_whitespace(str(text))
        score = float(scores[index]) if index < len(scores) else 0.0
        if clean_text and score >= 0.45:
            accepted_lines.append(clean_text)
            accepted_scores.append(score)

    confidence = sum(accepted_scores) / len(accepted_scores) if accepted_scores else 0.0
    return OcrResult(lines=accepted_lines, confidence=round(confidence, 3), engine="rapidocr")


def run_tesseract(frame_path: Path, tesseract_path: str | None) -> OcrResult:
    if not tesseract_path:
        return OcrResult(lines=[], confidence=0.0, engine="none")
    command = [tesseract_path, str(frame_path), "stdout", "--psm", "6"]
    try:
        completed = subprocess.run(command, check=True, capture_output=True, text=True, timeout=30)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return OcrResult(lines=[], confidence=0.0, engine="tesseract")

    lines = [normalize_whitespace(line) for line in completed.stdout.splitlines()]
    clean_lines = [line for line in lines if line]
    return OcrResult(lines=clean_lines, confidence=0.7 if clean_lines else 0.0, engine="tesseract")


def ocr_status_message(engine: str) -> str:
    if engine in {"rapidocr", "tesseract"}:
        return "OCR engine ran, but no readable text was detected in this frame."
    return "No OCR engine was available for this frame."


def visual_description_for_frame(start_seconds: int, ocr_result: OcrResult) -> str:
    timestamp = format_timestamp(start_seconds)
    if ocr_result.lines:
        return (
            f"Keyframe extracted around {timestamp}. Local {ocr_result.engine} OCR detected visible text; "
            "review the frame to confirm diagrams, equations, and layout."
        )
    if ocr_result.engine in {"rapidocr", "tesseract"}:
        return (
            f"Keyframe extracted around {timestamp}. OCR ran but did not find readable text; "
            "human review is needed for diagrams or low-contrast board work."
        )
    return (
        f"Keyframe extracted around {timestamp}. AccessiNote could not run OCR on this machine, "
        "so visible text and diagrams need human review."
    )


def source_confidence_for(transcript_text: str, ocr_result: OcrResult) -> float:
    confidence = 0.5
    if transcript_text:
        confidence += 0.18
    if ocr_result.lines:
        confidence += min(0.22, ocr_result.confidence * 0.22)
    return round(min(confidence, 0.92), 2)


def primary_engine_name(used_engines: set[str], has_rapidocr: bool, tesseract_path: str | None) -> str:
    if "rapidocr" in used_engines or has_rapidocr:
        return "rapidocr"
    if "tesseract" in used_engines or tesseract_path:
        return "tesseract"
    return "none"


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
