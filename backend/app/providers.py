from __future__ import annotations

import os
from pathlib import Path
from typing import TYPE_CHECKING, Protocol

from dotenv import load_dotenv

from .models import GenerateResponse, LectureTimeline, OutputMode, ProviderStatus

if TYPE_CHECKING:
    from .video_processor import OcrResult, TranscriptResult

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=False)


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


PROVIDER_CONFIG = {
    "transcription": {
        "env": "TRANSCRIPTION_PROVIDER",
        "default": "local",
        "options": {
            "local": [],
            "azure_speech": ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
        },
    },
    "ocr": {
        "env": "OCR_PROVIDER",
        "default": "local",
        "options": {
            "local": [],
            "azure_vision": ["AZURE_VISION_ENDPOINT", "AZURE_VISION_KEY"],
        },
    },
    "generation": {
        "env": "GENERATION_PROVIDER",
        "default": "local",
        "options": {
            "local": [],
            "azure_openai": ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "AZURE_OPENAI_DEPLOYMENT"],
        },
    },
}


def selected_provider(kind: str) -> str:
    config = PROVIDER_CONFIG[kind]
    return os.getenv(config["env"], config["default"]).strip().lower() or config["default"]


def provider_statuses() -> dict[str, ProviderStatus]:
    return {kind: provider_status(kind) for kind in PROVIDER_CONFIG}


def provider_status(kind: str) -> ProviderStatus:
    config = PROVIDER_CONFIG[kind]
    selected = selected_provider(kind)
    options = config["options"]
    required_env = options.get(selected, [])
    if selected not in options:
        return ProviderStatus(name=selected, enabled=True, configured=False, required_env=[])
    return ProviderStatus(
        name=selected,
        enabled=True,
        configured=all(os.getenv(env_name, "").strip() for env_name in required_env),
        required_env=required_env,
    )
