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
    ocr_confidence: float = 0.0
    visual_description: str = ""
    concepts: list[str] = Field(default_factory=list)
    source_confidence: float = 0.75
    keyframe_path: str = ""


class LectureTimeline(BaseModel):
    lecture_id: str
    title: str
    source: SourceInfo
    chunks: list[TimelineChunk]


class LectureSummary(BaseModel):
    lecture_id: str
    title: str
    source_type: str
    chunk_count: int
    ocr_chunk_count: int
    updated_at: str


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


class CapabilityResponse(BaseModel):
    ffmpeg_available: bool
    rapidocr_available: bool
    tesseract_available: bool
    video_upload_enabled: bool = True
    image_upload_enabled: bool = True
    ocr_engines: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class VideoUploadResponse(BaseModel):
    lecture_id: str
    status: str = "created"
    frame_count: int = 0
    ocr_frame_count: int = 0
    ocr_engine: str = "none"
    warnings: list[str] = Field(default_factory=list)


class ImageUploadResponse(BaseModel):
    lecture_id: str
    status: str = "created"
    ocr_text_count: int = 0
    ocr_engine: str = "none"
    warnings: list[str] = Field(default_factory=list)
