from __future__ import annotations

import hashlib
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .models import LectureTimeline, SourceInfo, TimelineChunk
from .retrieval import extract_concepts, format_timestamp, normalize_whitespace
from .video_processor import find_tesseract, ocr_status_message, rapidocr_available, run_local_ocr


@dataclass
class ImageProcessingResult:
    timeline: LectureTimeline
    warnings: list[str]
    ocr_text_count: int
    ocr_engine: str


def process_image_to_timeline(
    title: str,
    image_path: Path,
    outputs_dir: Path,
    notes_hint: str = "",
) -> ImageProcessingResult:
    clean_title = title.strip() or image_path.stem or "Uploaded Slide Image"
    lecture_id = make_image_lecture_id(clean_title, image_path)
    frames_dir = outputs_dir / f"{lecture_id}_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    frame_path = frames_dir / f"frame_0001{image_path.suffix.lower() or '.png'}"
    shutil.copyfile(image_path, frame_path)

    has_rapidocr = rapidocr_available()
    tesseract_path = find_tesseract()
    warnings = []
    if not has_rapidocr and not tesseract_path:
        warnings.append("No local OCR engine is available. The image was saved without OCR text.")

    ocr_result = run_local_ocr(frame_path, tesseract_path=tesseract_path, prefer_rapidocr=has_rapidocr)
    notes_text = normalize_whitespace(notes_hint)
    transcript = notes_text or (
        "Still image uploaded locally. No audio transcription is attached; use OCR text and human review "
        "to describe slide, board, or screenshot content."
    )
    ocr_items = ocr_result.lines or [ocr_status_message(ocr_result.engine)]
    concepts = extract_concepts(" ".join([transcript, " ".join(ocr_result.lines)]))[:5]
    source_confidence = 0.74 if ocr_result.lines else 0.48
    if notes_text and ocr_result.lines:
        source_confidence = 0.88

    timeline = LectureTimeline(
        lecture_id=lecture_id,
        title=clean_title,
        source=SourceInfo(
            type="image",
            attribution=f"Local image upload: {image_path.name}",
            license="User-provided permitted material",
            url="",
        ),
        chunks=[
            TimelineChunk(
                chunk_id="c1",
                start=format_timestamp(0),
                end=format_timestamp(0),
                transcript=transcript,
                ocr=ocr_items,
                ocr_confidence=ocr_result.confidence,
                visual_description=visual_description_for_image(ocr_result.engine, bool(ocr_result.lines)),
                concepts=concepts,
                source_confidence=source_confidence,
                keyframe_path=f"/api/lectures/{lecture_id}/frames/{frame_path.name}",
            )
        ],
    )
    return ImageProcessingResult(
        timeline=timeline,
        warnings=warnings,
        ocr_text_count=len(ocr_result.lines),
        ocr_engine=ocr_result.engine if ocr_result.engine != "none" else "none",
    )


def visual_description_for_image(engine: str, has_text: bool) -> str:
    if has_text:
        return (
            f"Still image scanned locally with {engine}. Review the image to confirm layout, diagrams, "
            "equations, and any text OCR may have missed."
        )
    if engine in {"rapidocr", "tesseract"}:
        return (
            "Still image scanned locally. OCR ran but did not detect readable text; human review is needed "
            "for diagrams, handwritten marks, or low-contrast content."
        )
    return "Still image saved locally, but no OCR engine was available on this machine."


def make_image_lecture_id(title: str, image_path: Path) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    seed_source = f"{title}:{image_path.name}:{image_path.stat().st_size}"
    seed = hashlib.sha1(seed_source.encode("utf-8")).hexdigest()[:8]
    return f"lecture_image_{timestamp}_{seed}"
