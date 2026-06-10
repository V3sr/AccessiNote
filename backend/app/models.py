from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


OutputMode = Literal[
    "structured_notes",
    "adhd_study_pack",
    "screen_reader_notes",
    "exam_prep_pack",
    "plain_language",
    "notetaker_quality_report",
]


class SourceInfo(BaseModel):
    type: str
    attribution: str = ""
    license: str = ""
    url: str = ""


class TimelineChunk(BaseModel):
    chunk_id: str
    start: str
    end: str
    transcript: str
    ocr: list[str] = Field(default_factory=list)
    visual_description: str = ""
    concepts: list[str] = Field(default_factory=list)
    source_confidence: float = 0.75
    keyframe_path: str = ""


class LectureTimeline(BaseModel):
    lecture_id: str
    title: str
    source: SourceInfo
    chunks: list[TimelineChunk]


class CreateLectureRequest(BaseModel):
    title: str = "Untitled Lecture"
    source_type: str = "transcript"
    transcript: str


class CreateLectureResponse(BaseModel):
    lecture_id: str
    status: str = "created"


class GenerateRequest(BaseModel):
    mode: OutputMode


class SourceReference(BaseModel):
    chunk_id: str
    start: str
    end: str
    reason: str


class GenerateResponse(BaseModel):
    lecture_id: str
    mode: OutputMode
    title: str
    content_markdown: str
    sources: list[SourceReference]
    warnings: list[str]
