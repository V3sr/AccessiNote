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
    "captions_vtt",
    "timeline_json",
    "transcript_txt",
]

JobStatus = Literal["queued", "running", "complete", "failed", "canceled"]


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
    evidence_flags: list[str] = Field(default_factory=list)


class CaptionSegment(BaseModel):
    start: str
    end: str
    text: str
    source: str = ""


class EvidenceMetrics(BaseModel):
    candidate_frame_count: int = 0
    selected_frame_count: int = 0
    extracted_frame_count: int = 0
    ocr_frame_count: int = 0
    transcript_segment_count: int = 0
    weak_chunk_count: int = 0
    average_source_confidence: float = 0.0
    ocr_engine: str = "none"
    transcription_engine: str = "none"
    caption_source: str = "none"


class FrameEvidence(BaseModel):
    timestamp: str
    reason: str
    keywords: list[str] = Field(default_factory=list)
    ocr_text_count: int = 0
    ocr_confidence: float = 0.0
    source_confidence: float = 0.0
    keyframe_path: str = ""


class ProcessingMetadata(BaseModel):
    pipeline_version: str = "local-v1"
    stages: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    metrics: EvidenceMetrics = Field(default_factory=EvidenceMetrics)
    frame_evidence: list[FrameEvidence] = Field(default_factory=list)
    providers: dict[str, str] = Field(default_factory=dict)


class LectureTimeline(BaseModel):
    lecture_id: str
    title: str
    source: SourceInfo
    chunks: list[TimelineChunk]
    caption_segments: list[CaptionSegment] = Field(default_factory=list)
    processing_metadata: ProcessingMetadata = Field(default_factory=ProcessingMetadata)


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
    local_transcription_available: bool = False
    transcription_engine: str = "none"
    video_upload_enabled: bool = True
    image_upload_enabled: bool = True
    ocr_engines: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class VideoUploadResponse(BaseModel):
    lecture_id: str
    status: str = "created"
    frame_count: int = 0
    candidate_frame_count: int = 0
    ocr_frame_count: int = 0
    ocr_engine: str = "none"
    transcript_segment_count: int = 0
    transcription_engine: str = "none"
    metrics: EvidenceMetrics = Field(default_factory=EvidenceMetrics)
    warnings: list[str] = Field(default_factory=list)


class ImageUploadResponse(BaseModel):
    lecture_id: str
    status: str = "created"
    ocr_text_count: int = 0
    ocr_engine: str = "none"
    warnings: list[str] = Field(default_factory=list)


class ProcessingJob(BaseModel):
    job_id: str
    kind: str = "video"
    status: JobStatus = "queued"
    stage: str = "queued"
    progress: int = 0
    lecture_id: str = ""
    warnings: list[str] = Field(default_factory=list)
    metrics: EvidenceMetrics = Field(default_factory=EvidenceMetrics)
    error: str = ""
    cancel_requested: bool = False
    created_at: str = ""
    updated_at: str = ""
