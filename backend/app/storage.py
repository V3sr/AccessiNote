from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .models import LectureSummary, LectureTimeline


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
SAMPLE_PATH = DATA_DIR / "samples" / "sample_lecture_timeline.json"
OUTPUTS_DIR = DATA_DIR / "outputs"
UPLOADS_DIR = DATA_DIR / "uploads"


def load_sample_timeline() -> LectureTimeline:
    return load_timeline_from_path(SAMPLE_PATH)


def load_saved_timeline(lecture_id: str) -> LectureTimeline | None:
    path = timeline_path(lecture_id)
    if not path.exists():
        return None
    return load_timeline_from_path(path)


def list_saved_timelines(limit: int = 20) -> list[LectureSummary]:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    summaries: list[LectureSummary] = []
    for path in sorted(OUTPUTS_DIR.glob("*.json"), key=lambda item: item.stat().st_mtime, reverse=True):
        try:
            timeline = load_timeline_from_path(path)
        except (json.JSONDecodeError, OSError, TypeError, ValueError):
            continue
        summaries.append(
            LectureSummary(
                lecture_id=timeline.lecture_id,
                title=timeline.title,
                source_type=timeline.source.type,
                chunk_count=len(timeline.chunks),
                ocr_chunk_count=sum(1 for chunk in timeline.chunks if has_readable_ocr(chunk.ocr)),
                updated_at=datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
            )
        )
        if len(summaries) >= limit:
            break
    return summaries


def save_timeline(timeline: LectureTimeline) -> None:
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    path = timeline_path(timeline.lecture_id)
    path.write_text(json.dumps(model_to_dict(timeline), indent=2), encoding="utf-8")


def load_timeline_from_path(path: Path) -> LectureTimeline:
    data = json.loads(path.read_text(encoding="utf-8"))
    return LectureTimeline(**data)


def timeline_path(lecture_id: str) -> Path:
    safe_id = "".join(char for char in lecture_id if char.isalnum() or char in {"_", "-"})
    return OUTPUTS_DIR / f"{safe_id}.json"


def model_to_dict(timeline: LectureTimeline) -> dict:
    if hasattr(timeline, "model_dump"):
        return timeline.model_dump()
    return timeline.dict()


def has_readable_ocr(items: list[str]) -> bool:
    for item in items:
        text = item.strip().lower()
        if text and not text.startswith("no ocr") and "no readable text" not in text:
            return True
    return False
