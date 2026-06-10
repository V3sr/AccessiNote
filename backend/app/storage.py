from __future__ import annotations

import json
from pathlib import Path

from .models import LectureTimeline


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
