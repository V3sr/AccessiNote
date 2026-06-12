from __future__ import annotations

from pathlib import Path
from typing import Protocol

from .models import GenerateResponse, LectureTimeline, OutputMode
from .video_processor import OcrResult, TranscriptResult


class TranscriptionProvider(Protocol):
    name: str

    def transcribe(self, video_path: Path) -> TranscriptResult:
        ...


class OcrProvider(Protocol):
    name: str

    def scan_image(self, image_path: Path) -> OcrResult:
        ...


class VisualUnderstandingProvider(Protocol):
    name: str

    def describe_frame(self, frame_path: Path, timestamp: str) -> str:
        ...


class GenerationProvider(Protocol):
    name: str

    def generate(self, timeline: LectureTimeline, mode: OutputMode) -> GenerateResponse:
        ...


LOCAL_PROVIDER_DEFAULTS = {
    "transcription": "local faster-whisper",
    "ocr": "local RapidOCR/Tesseract",
    "visual": "local frame evidence",
    "generation": "local deterministic",
}
