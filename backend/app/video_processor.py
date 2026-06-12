from __future__ import annotations

import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Callable

from .models import CaptionSegment, EvidenceMetrics, FrameEvidence, LectureTimeline, ProcessingMetadata, SourceInfo, TimelineChunk
from .retrieval import extract_concepts, format_timestamp, normalize_whitespace, split_transcript


EARLY_SAMPLE_SECONDS = [0, 2, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180]
DEFAULT_MAX_SELECTED_FRAMES = 72
DEFAULT_FRAME_SPAN_SECONDS = 12
WHISPER_MODEL_ENV = "ACCESSINOTE_WHISPER_MODEL"
MAX_VIDEO_FRAMES_ENV = "ACCESSINOTE_MAX_VIDEO_FRAMES"
SCENE_THRESHOLD_ENV = "ACCESSINOTE_SCENE_THRESHOLD"
TRANSCRIPTION_TIMEOUT_ENV = "ACCESSINOTE_TRANSCRIPTION_TIMEOUT_SECONDS"
CAPTION_TIMING_RE = re.compile(
    r"(?P<start>(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{1,3})?)\s*-->\s*"
    r"(?P<end>(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[,.]\d{1,3})?)"
)
StageCallback = Callable[[str, int], None]
PIPELINE_VERSION = "local-v2"


@dataclass
class VideoProcessingResult:
    timeline: LectureTimeline
    warnings: list[str]
    frame_count: int
    candidate_frame_count: int
    ocr_frame_count: int
    ocr_engine: str
    transcript_segment_count: int
    transcription_engine: str
    metrics: EvidenceMetrics


@dataclass
class ExtractedFrame:
    path: Path
    start_seconds: int
    reason: str = "periodic scan"
    keywords: list[str] | None = None


@dataclass
class OcrResult:
    lines: list[str]
    confidence: float
    engine: str


@dataclass
class TranscriptSegment:
    start_seconds: int
    end_seconds: int
    text: str
    concepts: list[str]
    source: str


@dataclass
class TranscriptResult:
    segments: list[TranscriptSegment]
    warnings: list[str]
    engine: str


@dataclass
class FrameSelection:
    start_seconds: int
    reason: str
    keywords: list[str]


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
    if faster_whisper_available():
        notes.append(
            f"Local caption generation is available through faster-whisper ({whisper_model_name()}). "
            "First use may download the selected model."
        )
    else:
        notes.append("Local caption generation is unavailable. Install faster-whisper or upload TXT/SRT/VTT captions.")
    if ffmpeg_available():
        notes.append(
            f"Video scans select up to {max_selected_frames()} timestamp(s) from early coverage, "
            "scene changes, transcript keywords, and periodic visual coverage."
        )
        notes.append("OCR scans original and enhanced frame variants to improve low-contrast text detection.")
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


def faster_whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


def whisper_model_name() -> str:
    return os.getenv(WHISPER_MODEL_ENV, "tiny.en").strip() or "tiny.en"


def transcription_timeout_seconds() -> int:
    raw_value = os.getenv(TRANSCRIPTION_TIMEOUT_ENV, "180").strip()
    try:
        value = int(raw_value)
    except ValueError:
        value = 180
    return max(1, min(value, 1800))


def max_selected_frames() -> int:
    raw_value = os.getenv(MAX_VIDEO_FRAMES_ENV, str(DEFAULT_MAX_SELECTED_FRAMES)).strip()
    try:
        value = int(raw_value)
    except ValueError:
        value = DEFAULT_MAX_SELECTED_FRAMES
    return max(12, min(value, 180))


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
    stage_callback: StageCallback | None = None,
) -> VideoProcessingResult:
    def report(stage: str, progress: int) -> None:
        if stage_callback:
            stage_callback(stage, progress)

    report("upload received", 5)
    clean_title = title.strip() or video_path.stem or "Uploaded Video Lecture"
    lecture_id = make_lecture_id(clean_title, video_path)
    frames_dir = outputs_dir / f"{lecture_id}_frames"
    frames_dir.mkdir(parents=True, exist_ok=True)

    warnings: list[str] = []
    completed_stages = ["upload received"]
    report("parsing transcript", 10)
    transcript_result = transcript_segments_from_text(transcript_hint)
    warnings.extend(transcript_result.warnings)
    completed_stages.append("parsing transcript")

    ffmpeg_path = find_ffmpeg()
    if not ffmpeg_path:
        warnings.append("ffmpeg is unavailable. Video frames were not extracted.")
        timeline = placeholder_timeline(
            lecture_id=lecture_id,
            title=clean_title,
            video_path=video_path,
            transcript_segments=transcript_result.segments,
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
            candidate_frame_count=0,
            ocr_frame_count=0,
            ocr_engine="none",
            transcript_segment_count=len(transcript_result.segments),
            transcription_engine=transcript_result.engine,
            metrics=timeline.processing_metadata.metrics,
        )

    if not transcript_result.segments:
        report("extracting audio", 18)
        generated_transcript = transcribe_video_to_segments(video_path, frames_dir, ffmpeg_path, report)
        warnings.extend(generated_transcript.warnings)
        transcript_result = generated_transcript
        completed_stages.append("transcribing audio")

    report("finding visual changes", 42)
    duration_seconds = parse_video_duration(video_path, ffmpeg_path)
    scene_selections = detect_scene_change_selections(video_path, ffmpeg_path, duration_seconds)
    candidate_selections = select_frame_seconds(duration_seconds, transcript_result.segments, scene_selections)
    selections = final_frame_selections(candidate_selections)
    completed_stages.append("finding visual changes")

    report("extracting frames", 52)
    frames = extract_keyframes(video_path, frames_dir, ffmpeg_path, selections)
    completed_stages.append("extracting frames")
    if not frames:
        warnings.append("ffmpeg ran, but no keyframes were extracted from the uploaded video.")
        timeline = placeholder_timeline(
            lecture_id=lecture_id,
            title=clean_title,
            video_path=video_path,
            transcript_segments=transcript_result.segments,
            ocr_message="No keyframes were available for OCR scanning.",
            visual_message="No video frames were extracted. Confirm the file is a readable video.",
            confidence=0.4,
        )
        return VideoProcessingResult(
            timeline=timeline,
            warnings=warnings,
            frame_count=0,
            candidate_frame_count=len(candidate_selections),
            ocr_frame_count=0,
            ocr_engine="none",
            transcript_segment_count=len(transcript_result.segments),
            transcription_engine=transcript_result.engine,
            metrics=timeline.processing_metadata.metrics,
        )

    has_rapidocr = rapidocr_available()
    tesseract_path = find_tesseract()
    if not has_rapidocr and not tesseract_path:
        warnings.append("No local OCR engine is available. Keyframes were extracted without OCR text.")

    report("running OCR", 68)
    chunks = []
    frame_evidence = []
    used_engines: set[str] = set()
    ocr_frame_count = 0
    for index, frame in enumerate(frames, start=1):
        start_seconds = frame.start_seconds
        ocr_result = run_local_ocr(frame.path, tesseract_path=tesseract_path, prefer_rapidocr=has_rapidocr)
        if ocr_result.engine != "none":
            used_engines.add(ocr_result.engine)
        if ocr_result.lines:
            ocr_frame_count += 1

        report("aligning evidence", min(88, 70 + int(index / max(1, len(frames)) * 18)))
        transcript_text = transcript_for_frame(transcript_result.segments, start_seconds, index, len(frames))
        transcript = transcript_text or (
            "Video keyframe extracted locally. No audio transcription provider is configured, "
            "so transcript text is not available for this timestamp."
        )
        ocr_items = ocr_result.lines or [ocr_status_message(ocr_result.engine)]
        concepts = stable_concepts(frame.keywords or [], transcript, ocr_result.lines)
        evidence_flags = evidence_flags_for(transcript_text, ocr_result, frame.reason)
        source_confidence = source_confidence_for(transcript_text, ocr_result, frame.reason)
        end_seconds = chunk_end_seconds(start_seconds, frames, index, transcript_result.segments)
        keyframe_path = f"/api/lectures/{lecture_id}/frames/{frame.path.name}"
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(start_seconds),
                end=format_timestamp(end_seconds),
                transcript=transcript,
                ocr=ocr_items,
                ocr_confidence=ocr_result.confidence,
                visual_description=(
                    visual_description_for_frame(start_seconds, ocr_result, frame.reason, frame.keywords or [])
                ),
                concepts=concepts,
                source_confidence=source_confidence,
                keyframe_path=keyframe_path,
                evidence_flags=evidence_flags,
            )
        )
        frame_evidence.append(
            FrameEvidence(
                timestamp=format_timestamp(start_seconds),
                reason=frame.reason,
                keywords=frame.keywords or [],
                ocr_text_count=len(ocr_result.lines),
                ocr_confidence=ocr_result.confidence,
                source_confidence=source_confidence,
                keyframe_path=keyframe_path,
            )
        )
    completed_stages.extend(["running OCR", "aligning evidence", "assembling timeline"])

    primary_ocr_engine = primary_engine_name(used_engines, has_rapidocr, tesseract_path)
    metrics = build_evidence_metrics(
        candidate_count=len(candidate_selections),
        selected_count=len(selections),
        extracted_count=len(frames),
        ocr_frame_count=ocr_frame_count,
        transcript_result=transcript_result,
        chunks=chunks,
        ocr_engine=primary_ocr_engine,
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
        caption_segments=caption_segments_for_timeline(transcript_result.segments),
        processing_metadata=ProcessingMetadata(
            pipeline_version=PIPELINE_VERSION,
            stages=completed_stages,
            warnings=warnings,
            metrics=metrics,
            frame_evidence=frame_evidence,
            providers=provider_metadata(primary_ocr_engine, transcript_result.engine),
        ),
    )
    report("ready for review", 100)
    return VideoProcessingResult(
        timeline=timeline,
        warnings=warnings,
        frame_count=len(frames),
        candidate_frame_count=len(candidate_selections),
        ocr_frame_count=ocr_frame_count,
        ocr_engine=primary_ocr_engine,
        transcript_segment_count=len(transcript_result.segments),
        transcription_engine=transcript_result.engine,
        metrics=metrics,
    )


def extract_keyframes(video_path: Path, frames_dir: Path, ffmpeg_path: str, selections: list[FrameSelection]) -> list[ExtractedFrame]:
    for existing in frames_dir.glob("frame_*.jpg"):
        existing.unlink(missing_ok=True)

    frames: list[ExtractedFrame] = []
    for index, selection in enumerate(selections, start=1):
        start_seconds = selection.start_seconds
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
            frames.append(
                ExtractedFrame(
                    path=frame_path,
                    start_seconds=start_seconds,
                    reason=selection.reason,
                    keywords=selection.keywords,
                )
            )

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


def select_frame_seconds(
    duration_seconds: int | None,
    segments: list[TranscriptSegment],
    scene_selections: list[FrameSelection] | None = None,
) -> list[FrameSelection]:
    candidate_budget = max(max_selected_frames() * 3, max_selected_frames() + 24)
    selections: dict[int, FrameSelection] = {}

    def add(seconds: int, reason: str, keywords: list[str] | None = None) -> None:
        if seconds < 0:
            return
        if duration_seconds is not None and seconds > duration_seconds:
            return
        bucketed = max(0, int(seconds))
        existing = selections.get(bucketed)
        if existing:
            existing.keywords = merge_keywords(existing.keywords, keywords or [])
            if reason not in existing.reason:
                existing.reason = f"{existing.reason}; {reason}"
            return
        selections[bucketed] = FrameSelection(
            start_seconds=bucketed,
            reason=reason,
            keywords=list(keywords or []),
        )

    for seconds in EARLY_SAMPLE_SECONDS:
        add(seconds, "early coverage")

    for selection in scene_selections or []:
        add(selection.start_seconds, selection.reason, selection.keywords)

    if segments:
        scored = sorted(score_segments(segments), key=lambda item: item[0], reverse=True)
        top_segments = scored[: max(12, candidate_budget // 3)]
        for _, segment in top_segments:
            keywords = segment.concepts[:4]
            add(segment.start_seconds, "transcript keyword point", keywords)
            midpoint = segment.start_seconds + max(0, (segment.end_seconds - segment.start_seconds) // 2)
            add(midpoint, "transcript segment midpoint", keywords)

        coverage_segments = evenly_spaced_segments(
            sorted(segments, key=lambda item: item.start_seconds),
            count=max(8, candidate_budget // 4),
        )
        for segment in coverage_segments:
            add(segment.start_seconds, "transcript coverage point", segment.concepts[:4])

        if duration_seconds:
            # Keep a light backbone through the whole video so visual-only slides are not entirely missed.
            interval = adaptive_interval(duration_seconds, target_count=max(12, candidate_budget // 3))
            for seconds in range(0, duration_seconds + 1, interval):
                add(seconds, "periodic coverage")
    else:
        fallback_duration = duration_seconds or 15 * candidate_budget
        interval = adaptive_interval(fallback_duration, target_count=candidate_budget)
        for seconds in range(0, fallback_duration + 1, interval):
            add(seconds, "periodic coverage")

    ordered = sorted(selections.values(), key=lambda item: item.start_seconds)
    if len(ordered) <= candidate_budget:
        return ordered

    early_budget = min(18, max(6, candidate_budget // 7))
    early = [item for item in ordered if item.reason.startswith("early coverage")][:early_budget]
    transcript_priority = [
        item
        for item in ordered
        if "keyword" in item.reason or "midpoint" in item.reason or "transcript coverage" in item.reason
    ]
    visual_priority = [item for item in ordered if "visual change" in item.reason]
    periodic = [item for item in ordered if item not in early and item not in transcript_priority and item not in visual_priority]
    chosen = dedupe_selections(early)
    remaining = candidate_budget - len(chosen)
    visual_count = min(len(visual_priority), math.ceil(remaining * 0.35))
    chosen = dedupe_selections(chosen + evenly_spaced(visual_priority, visual_count))
    remaining = candidate_budget - len(chosen)
    transcript_count = min(len(transcript_priority), math.ceil(remaining * 0.75))
    chosen = dedupe_selections(chosen + evenly_spaced(transcript_priority, transcript_count))
    remaining = candidate_budget - len(chosen)
    if remaining > 0:
        chosen = dedupe_selections(chosen + evenly_spaced(periodic, remaining))
    return sorted(chosen[:candidate_budget], key=lambda item: item.start_seconds)


def final_frame_selections(candidate_selections: list[FrameSelection]) -> list[FrameSelection]:
    frame_budget = max_selected_frames()
    if len(candidate_selections) <= frame_budget:
        return candidate_selections

    early = [item for item in candidate_selections if item.reason.startswith("early coverage")][:12]
    visual = [item for item in candidate_selections if "visual change" in item.reason]
    transcript = [
        item
        for item in candidate_selections
        if "keyword" in item.reason or "midpoint" in item.reason or "transcript coverage" in item.reason
    ]
    periodic = [item for item in candidate_selections if item not in early and item not in visual and item not in transcript]

    chosen = dedupe_selections(early)
    remaining = frame_budget - len(chosen)
    visual_count = min(len(visual), max(0, math.ceil(remaining * 0.35)))
    chosen = dedupe_selections(chosen + evenly_spaced(visual, visual_count))
    remaining = frame_budget - len(chosen)
    transcript_count = min(len(transcript), max(0, math.ceil(remaining * 0.75)))
    chosen = dedupe_selections(chosen + evenly_spaced(transcript, transcript_count))
    remaining = frame_budget - len(chosen)
    if remaining > 0:
        chosen = dedupe_selections(chosen + evenly_spaced(periodic, remaining))
    return sorted(chosen[:frame_budget], key=lambda item: item.start_seconds)


def detect_scene_change_selections(
    video_path: Path,
    ffmpeg_path: str,
    duration_seconds: int | None,
) -> list[FrameSelection]:
    threshold = scene_threshold()
    command = [
        ffmpeg_path,
        "-hide_banner",
        "-i",
        str(video_path),
        "-vf",
        f"select='gt(scene,{threshold})',showinfo",
        "-an",
        "-f",
        "null",
        "-",
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=120)
    except (subprocess.TimeoutExpired, OSError):
        return []
    output = f"{completed.stderr}\n{completed.stdout}"
    raw_seconds = []
    for match in re.finditer(r"pts_time:(\d+(?:\.\d+)?)", output):
        seconds = int(float(match.group(1)))
        if duration_seconds is None or 0 <= seconds <= duration_seconds:
            raw_seconds.append(seconds)
    deduped: list[int] = []
    for seconds in sorted(set(raw_seconds)):
        if not deduped or seconds - deduped[-1] >= 3:
            deduped.append(seconds)
    return [
        FrameSelection(start_seconds=seconds, reason="visual change candidate", keywords=[])
        for seconds in deduped[: max_selected_frames()]
    ]


def scene_threshold() -> float:
    raw_value = os.getenv(SCENE_THRESHOLD_ENV, "0.22").strip()
    try:
        value = float(raw_value)
    except ValueError:
        value = 0.22
    return max(0.08, min(value, 0.6))


def adaptive_interval(duration_seconds: int, target_count: int) -> int:
    if duration_seconds <= 0:
        return 5
    return max(5, math.ceil(duration_seconds / max(1, target_count)))


def score_segments(segments: list[TranscriptSegment]) -> list[tuple[int, TranscriptSegment]]:
    concept_counts: dict[str, int] = {}
    for segment in segments:
        for concept in segment.concepts:
            concept_counts[concept] = concept_counts.get(concept, 0) + 1

    scored: list[tuple[int, TranscriptSegment]] = []
    seen_concepts: set[str] = set()
    for segment in segments:
        new_concepts = [concept for concept in segment.concepts if concept not in seen_concepts]
        for concept in segment.concepts:
            seen_concepts.add(concept)
        score = len(segment.text.split())
        score += len(new_concepts) * 18
        score += sum(concept_counts.get(concept, 0) for concept in segment.concepts)
        scored.append((score, segment))
    return scored


def evenly_spaced(items: list[FrameSelection], count: int) -> list[FrameSelection]:
    if count <= 0 or not items:
        return []
    if len(items) <= count:
        return items
    step = (len(items) - 1) / max(1, count - 1)
    return [items[round(index * step)] for index in range(count)]


def evenly_spaced_segments(items: list[TranscriptSegment], count: int) -> list[TranscriptSegment]:
    if count <= 0 or not items:
        return []
    if len(items) <= count:
        return items
    step = (len(items) - 1) / max(1, count - 1)
    return [items[round(index * step)] for index in range(count)]


def dedupe_selections(items: list[FrameSelection]) -> list[FrameSelection]:
    deduped: dict[int, FrameSelection] = {}
    for item in items:
        deduped[item.start_seconds] = item
    return list(deduped.values())


def merge_keywords(left: list[str], right: list[str]) -> list[str]:
    merged = list(left)
    for keyword in right:
        if keyword not in merged:
            merged.append(keyword)
    return merged[:6]


def transcript_segments_from_text(text: str) -> TranscriptResult:
    clean_text = text.strip()
    if not clean_text:
        return TranscriptResult(segments=[], warnings=[], engine="none")

    caption_segments = parse_caption_segments(clean_text)
    if caption_segments:
        return TranscriptResult(segments=caption_segments, warnings=[], engine="uploaded captions")

    chunks = split_transcript(normalize_whitespace(clean_text), target_words=70)
    segments = []
    current_start = 0
    for index, chunk in enumerate(chunks, start=1):
        duration = max(20, min(90, len(chunk.split()) * 2))
        segments.append(
            TranscriptSegment(
                start_seconds=current_start,
                end_seconds=current_start + duration,
                text=chunk,
                concepts=extract_concepts(chunk),
                source="uploaded transcript",
            )
        )
        current_start += duration
    return TranscriptResult(segments=segments, warnings=[], engine="uploaded transcript")


def parse_caption_segments(text: str) -> list[TranscriptSegment]:
    lines = text.splitlines()
    segments: list[TranscriptSegment] = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        match = CAPTION_TIMING_RE.search(line)
        if not match:
            index += 1
            continue

        start_seconds = parse_caption_timestamp(match.group("start"))
        end_seconds = parse_caption_timestamp(match.group("end"))
        index += 1
        text_lines = []
        while index < len(lines):
            body_line = lines[index].strip()
            if not body_line:
                break
            if CAPTION_TIMING_RE.search(body_line):
                index -= 1
                break
            if not body_line.isdigit() and body_line.upper() != "WEBVTT":
                text_lines.append(strip_caption_markup(body_line))
            index += 1

        caption_text = normalize_whitespace(" ".join(text_lines))
        if caption_text:
            segments.append(
                TranscriptSegment(
                    start_seconds=start_seconds,
                    end_seconds=max(end_seconds, start_seconds + 1),
                    text=caption_text,
                    concepts=extract_concepts(caption_text),
                    source="uploaded captions",
                )
            )
        index += 1
    return merge_short_segments(segments)


def merge_short_segments(segments: list[TranscriptSegment]) -> list[TranscriptSegment]:
    if not segments:
        return []
    merged: list[TranscriptSegment] = []
    pending = segments[0]
    for segment in segments[1:]:
        pending_words = len(pending.text.split())
        segment_words = len(segment.text.split())
        if pending_words < 6 and segment_words < 8 and segment.start_seconds - pending.end_seconds <= 1:
            combined_text = normalize_whitespace(f"{pending.text} {segment.text}")
            pending = TranscriptSegment(
                start_seconds=pending.start_seconds,
                end_seconds=segment.end_seconds,
                text=combined_text,
                concepts=extract_concepts(combined_text),
                source=pending.source,
            )
        else:
            merged.append(pending)
            pending = segment
    merged.append(pending)
    return merged


def parse_caption_timestamp(value: str) -> int:
    normalized = value.replace(",", ".")
    parts = normalized.split(":")
    if len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        hours, minutes, seconds = parts[-3:]
    return int(hours) * 3600 + int(minutes) * 60 + int(float(seconds))


def strip_caption_markup(value: str) -> str:
    without_tags = re.sub(r"<[^>]+>", "", value)
    without_styles = re.sub(r"\{[^}]+\}", "", without_tags)
    return without_styles.strip()


def transcribe_video_to_segments(
    video_path: Path,
    frames_dir: Path,
    ffmpeg_path: str,
    stage_callback: StageCallback | None = None,
) -> TranscriptResult:
    if not faster_whisper_available():
        return TranscriptResult(
            segments=[],
            warnings=["Local caption generation is unavailable because faster-whisper is not installed."],
            engine="none",
        )

    audio_path = frames_dir / "transcription_audio.wav"
    if stage_callback:
        stage_callback("extracting audio", 18)
    if not extract_audio_for_transcription(video_path, audio_path, ffmpeg_path):
        return TranscriptResult(
            segments=[],
            warnings=["Local caption generation could not extract an audio track from the uploaded video."],
            engine="faster-whisper",
        )

    output_path = frames_dir / "transcription_segments.json"
    try:
        if stage_callback:
            stage_callback("loading caption model", 20)
        run_whisper_subprocess(audio_path, output_path)
        if stage_callback:
            stage_callback("segmenting captions", 36)
        raw_segments = json.loads(output_path.read_text(encoding="utf-8"))
        segments = []
        for raw_segment in raw_segments:
            text = normalize_whitespace(str(raw_segment.get("text", "")))
            if not text:
                continue
            start_seconds = max(0, int(float(raw_segment.get("start", 0))))
            end_seconds = max(start_seconds + 1, int(float(raw_segment.get("end", start_seconds + 1))))
            segments.append(
                TranscriptSegment(
                    start_seconds=start_seconds,
                    end_seconds=end_seconds,
                    text=text,
                    concepts=extract_concepts(text),
                    source="local faster-whisper",
                )
            )
    except subprocess.TimeoutExpired:
        return TranscriptResult(
            segments=[],
            warnings=[
                "Local caption generation timed out. AccessiNote continued with visual frame scanning and OCR; "
                "upload captions or increase ACCESSINOTE_TRANSCRIPTION_TIMEOUT_SECONDS for full captions."
            ],
            engine="faster-whisper timeout",
        )
    except Exception as error:
        if error.__class__.__name__ in {"JobCanceled", "JobStopped"}:
            raise
        return TranscriptResult(
            segments=[],
            warnings=[f"Local caption generation failed: {error}"],
            engine="faster-whisper",
        )
    finally:
        audio_path.unlink(missing_ok=True)
        output_path.unlink(missing_ok=True)

    if not segments:
        return TranscriptResult(
            segments=[],
            warnings=["Local caption generation ran, but no speech segments were detected."],
            engine="faster-whisper",
        )
    return TranscriptResult(segments=segments, warnings=[], engine="faster-whisper")


def run_whisper_subprocess(audio_path: Path, output_path: Path) -> None:
    helper_code = r"""
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model_name = sys.argv[2]
output_path = Path(sys.argv[3])

model = WhisperModel(model_name, device="cpu", compute_type="int8")
segments, _info = model.transcribe(audio_path, beam_size=1, vad_filter=True)
payload = [
    {"start": float(segment.start), "end": float(segment.end), "text": segment.text}
    for segment in segments
]
output_path.write_text(json.dumps(payload), encoding="utf-8")
"""
    subprocess.run(
        [sys.executable, "-c", helper_code, str(audio_path), whisper_model_name(), str(output_path)],
        check=True,
        capture_output=True,
        text=True,
        timeout=transcription_timeout_seconds(),
    )


def caption_segments_for_timeline(segments: list[TranscriptSegment]) -> list[CaptionSegment]:
    return [
        CaptionSegment(
            start=format_timestamp(segment.start_seconds),
            end=format_timestamp(segment.end_seconds),
            text=segment.text,
            source=segment.source,
        )
        for segment in segments
    ]


def extract_audio_for_transcription(video_path: Path, audio_path: Path, ffmpeg_path: str) -> bool:
    command = [
        ffmpeg_path,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-f",
        "wav",
        str(audio_path),
    ]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True, timeout=180)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False
    return audio_path.exists() and audio_path.stat().st_size > 0


@lru_cache(maxsize=1)
def get_whisper_model():
    from faster_whisper import WhisperModel

    return WhisperModel(whisper_model_name(), device="cpu", compute_type="int8")


def run_local_ocr(frame_path: Path, tesseract_path: str | None, prefer_rapidocr: bool) -> OcrResult:
    variants = [frame_path] + create_ocr_variants(frame_path)
    rapid_results: list[OcrResult] = []
    if prefer_rapidocr:
        for variant_path in variants:
            rapid_results.append(run_rapidocr(variant_path))
        rapid_result = merge_ocr_results(rapid_results, fallback_engine="rapidocr")
        if rapid_result.lines or not tesseract_path:
            return rapid_result

    tesseract_results = [run_tesseract(variant_path, tesseract_path) for variant_path in variants[:2]]
    tesseract_result = merge_ocr_results(tesseract_results, fallback_engine="tesseract" if tesseract_path else "none")
    if tesseract_result.lines:
        return tesseract_result

    return OcrResult(lines=[], confidence=0.0, engine="rapidocr" if prefer_rapidocr else "none")


def create_ocr_variants(frame_path: Path) -> list[Path]:
    ffmpeg_path = find_ffmpeg()
    if not ffmpeg_path:
        return []
    variant_dir = frame_path.parent / "_ocr_variants"
    variant_dir.mkdir(exist_ok=True)
    variant_specs = [
        ("upscale", "scale='min(1920,iw*2)':-1:flags=lanczos,unsharp=5:5:0.8"),
        ("contrast", "eq=contrast=1.35:brightness=0.03:saturation=0.7,unsharp=5:5:0.6"),
        ("gray", "format=gray,eq=contrast=1.55:brightness=0.04,unsharp=5:5:0.7"),
    ]
    variants = []
    for name, video_filter in variant_specs:
        variant_path = variant_dir / f"{frame_path.stem}_{name}.jpg"
        command = [
            ffmpeg_path,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(frame_path),
            "-vf",
            video_filter,
            "-q:v",
            "2",
            str(variant_path),
        ]
        try:
            subprocess.run(command, check=True, capture_output=True, text=True, timeout=20)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            continue
        if variant_path.exists() and variant_path.stat().st_size > 0:
            variants.append(variant_path)
    return variants


def merge_ocr_results(results: list[OcrResult], fallback_engine: str) -> OcrResult:
    lines: list[str] = []
    scores = []
    engine = fallback_engine
    for result in results:
        if result.engine != "none":
            engine = result.engine
        for line in result.lines:
            if line not in lines:
                lines.append(line)
        if result.confidence > 0:
            scores.append(result.confidence)
    confidence = sum(scores) / len(scores) if scores else 0.0
    return OcrResult(lines=lines[:12], confidence=round(confidence, 3), engine=engine)


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


def visual_description_for_frame(
    start_seconds: int,
    ocr_result: OcrResult,
    selection_reason: str,
    keywords: list[str],
) -> str:
    timestamp = format_timestamp(start_seconds)
    selection_text = f" Selected because: {selection_reason}."
    if keywords:
        selection_text += f" Transcript keywords: {', '.join(keywords[:4])}."
    if ocr_result.lines:
        return (
            f"Keyframe extracted around {timestamp}. Local {ocr_result.engine} OCR detected visible text; "
            f"review the frame to confirm diagrams, equations, and layout.{selection_text}"
        )
    if ocr_result.engine in {"rapidocr", "tesseract"}:
        return (
            f"Keyframe extracted around {timestamp}. OCR ran but did not find readable text; "
            f"human review is needed for diagrams or low-contrast board work.{selection_text}"
        )
    return (
        f"Keyframe extracted around {timestamp}. AccessiNote could not run OCR on this machine, "
        f"so visible text and diagrams need human review.{selection_text}"
    )


def source_confidence_for(transcript_text: str, ocr_result: OcrResult, selection_reason: str = "") -> float:
    confidence = 0.5
    if transcript_text:
        confidence += 0.2
    if ocr_result.lines:
        confidence += min(0.22, ocr_result.confidence * 0.22)
    if "visual change" in selection_reason:
        confidence += 0.05
    if "keyword" in selection_reason or "transcript coverage" in selection_reason:
        confidence += 0.05
    return round(min(confidence, 0.92), 2)


def evidence_flags_for(transcript_text: str, ocr_result: OcrResult, selection_reason: str) -> list[str]:
    flags = []
    if transcript_text:
        flags.append("audio/transcript aligned")
    else:
        flags.append("missing transcript")
    if ocr_result.lines:
        flags.append("ocr text found")
    else:
        flags.append("no readable OCR")
    if "visual change" in selection_reason:
        flags.append("visual change")
    if "keyword" in selection_reason or "transcript coverage" in selection_reason:
        flags.append("keyword-timed")
    return flags


def build_evidence_metrics(
    candidate_count: int,
    selected_count: int,
    extracted_count: int,
    ocr_frame_count: int,
    transcript_result: TranscriptResult,
    chunks: list[TimelineChunk],
    ocr_engine: str,
) -> EvidenceMetrics:
    average_confidence = (
        sum(chunk.source_confidence for chunk in chunks) / len(chunks)
        if chunks
        else 0.0
    )
    weak_chunk_count = sum(1 for chunk in chunks if chunk.source_confidence < 0.68 or "missing transcript" in chunk.evidence_flags)
    return EvidenceMetrics(
        candidate_frame_count=candidate_count,
        selected_frame_count=selected_count,
        extracted_frame_count=extracted_count,
        ocr_frame_count=ocr_frame_count,
        transcript_segment_count=len(transcript_result.segments),
        weak_chunk_count=weak_chunk_count,
        average_source_confidence=round(average_confidence, 3),
        ocr_engine=ocr_engine,
        transcription_engine=transcript_result.engine,
        caption_source=transcript_result.engine,
    )


def provider_metadata(ocr_engine: str, transcription_engine: str) -> dict[str, str]:
    return {
        "pipeline": PIPELINE_VERSION,
        "frame_extraction": "ffmpeg",
        "ocr": ocr_engine,
        "transcription": transcription_engine,
        "generation": "local deterministic",
    }


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
    transcript_segments: list[TranscriptSegment],
    ocr_message: str,
    visual_message: str,
    confidence: float,
) -> LectureTimeline:
    chunks = []
    source_segments = transcript_segments or [
        TranscriptSegment(
            start_seconds=0,
            end_seconds=DEFAULT_FRAME_SPAN_SECONDS,
            text="Video uploaded locally. No transcript was provided and local video scanning tools are not available yet.",
            concepts=["video review"],
            source="fallback",
        )
    ]
    for index, segment in enumerate(source_segments, start=1):
        start_seconds = segment.start_seconds
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(start_seconds),
                end=format_timestamp(max(segment.end_seconds, start_seconds + DEFAULT_FRAME_SPAN_SECONDS)),
                transcript=segment.text,
                ocr=[ocr_message],
                visual_description=visual_message,
                concepts=segment.concepts or extract_concepts(segment.text),
                source_confidence=confidence,
                keyframe_path="",
                evidence_flags=["fallback timeline", "missing frame evidence"],
            )
        )

    metrics = EvidenceMetrics(
        transcript_segment_count=len(transcript_segments),
        weak_chunk_count=len(chunks),
        average_source_confidence=confidence,
        caption_source=transcript_segments[0].source if transcript_segments else "none",
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
        caption_segments=caption_segments_for_timeline(transcript_segments),
        processing_metadata=ProcessingMetadata(
            pipeline_version=PIPELINE_VERSION,
            stages=["fallback timeline"],
            warnings=[visual_message],
            metrics=metrics,
            providers=provider_metadata("none", metrics.caption_source),
        ),
    )


def transcript_for_frame(
    transcript_segments: list[TranscriptSegment],
    start_seconds: int,
    frame_index: int,
    frame_count: int,
) -> str:
    if not transcript_segments:
        return ""
    nearby = [
        segment
        for segment in transcript_segments
        if segment.start_seconds <= start_seconds + DEFAULT_FRAME_SPAN_SECONDS
        and segment.end_seconds >= max(0, start_seconds - 3)
    ]
    if nearby:
        return normalize_whitespace(" ".join(segment.text for segment in nearby[:3]))

    nearest = min(transcript_segments, key=lambda segment: abs(segment.start_seconds - start_seconds))
    return nearest.text


def chunk_end_seconds(
    start_seconds: int,
    frames: list[ExtractedFrame],
    frame_index: int,
    transcript_segments: list[TranscriptSegment],
) -> int:
    overlapping = [
        segment.end_seconds
        for segment in transcript_segments
        if segment.start_seconds <= start_seconds + DEFAULT_FRAME_SPAN_SECONDS
        and segment.end_seconds >= start_seconds
    ]
    if overlapping:
        return max(start_seconds + 1, min(max(overlapping), start_seconds + 90))
    if frame_index < len(frames):
        return max(start_seconds + 1, min(frames[frame_index].start_seconds, start_seconds + 90))
    return start_seconds + DEFAULT_FRAME_SPAN_SECONDS


def stable_concepts(frame_keywords: list[str], transcript: str, ocr_lines: list[str]) -> list[str]:
    concepts = []
    for keyword in frame_keywords:
        if keyword and keyword not in concepts:
            concepts.append(keyword)
    for concept in extract_concepts(" ".join([transcript, " ".join(ocr_lines)])):
        if concept not in concepts:
            concepts.append(concept)
    return concepts[:5] or ["video evidence"]


def make_lecture_id(title: str, video_path: Path) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    seed_source = f"{title}:{video_path.name}:{video_path.stat().st_size}"
    seed = hashlib.sha1(seed_source.encode("utf-8")).hexdigest()[:8]
    return f"lecture_video_{timestamp}_{seed}"
