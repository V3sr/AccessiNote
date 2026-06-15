from __future__ import annotations

import os
from pathlib import Path
from threading import Lock
from contextvars import ContextVar, Token
from typing import TYPE_CHECKING, Protocol

from dotenv import load_dotenv

from .models import GenerateResponse, LectureTimeline, OutputMode, ProviderSettingsRequest, ProviderSettingsResponse, ProviderStatus

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

PROVIDER_ENV_TO_REQUEST_FIELD = {
    "TRANSCRIPTION_PROVIDER": "transcription_provider",
    "OCR_PROVIDER": "ocr_provider",
    "GENERATION_PROVIDER": "generation_provider",
    "AZURE_SPEECH_KEY": "azure_speech_key",
    "AZURE_SPEECH_REGION": "azure_speech_region",
    "AZURE_SPEECH_LANGUAGE": "azure_speech_language",
    "AZURE_VISION_ENDPOINT": "azure_vision_endpoint",
    "AZURE_VISION_KEY": "azure_vision_key",
    "AZURE_OPENAI_ENDPOINT": "azure_openai_endpoint",
    "AZURE_OPENAI_API_KEY": "azure_openai_api_key",
    "AZURE_OPENAI_DEPLOYMENT": "azure_openai_deployment",
}

DEFAULT_RUNTIME_SESSION = "__default__"
CURRENT_PROVIDER_SESSION: ContextVar[str] = ContextVar("accessinote_provider_session", default=DEFAULT_RUNTIME_SESSION)
RUNTIME_PROVIDER_SETTINGS: dict[str, dict[str, str]] = {}
RUNTIME_PROVIDER_LOCK = Lock()


def selected_provider(kind: str) -> str:
    config = PROVIDER_CONFIG[kind]
    return provider_value(config["env"], config["default"]).strip().lower() or config["default"]


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
        configured=all(provider_value(env_name, "").strip() for env_name in required_env),
        required_env=required_env,
    )


def get_provider_settings() -> ProviderSettingsResponse:
    return ProviderSettingsResponse(
        providers=provider_statuses(),
        configured_env=configured_provider_env_names(),
        message="Provider settings loaded. Secret values are never returned.",
        runtime_settings_enabled=runtime_provider_settings_enabled(),
        session_id=current_provider_session(),
    )


def update_provider_settings(request: ProviderSettingsRequest) -> ProviderSettingsResponse:
    if request.clear_existing:
        clear_runtime_provider_session()

    updates = request.model_dump(exclude={"clear_existing"}, exclude_none=True)
    provider_updates = {
        "TRANSCRIPTION_PROVIDER": request.transcription_provider,
        "OCR_PROVIDER": request.ocr_provider,
        "GENERATION_PROVIDER": request.generation_provider,
    }
    for env_name, value in provider_updates.items():
        set_runtime_provider_value(env_name, value)

    for env_name, request_field in PROVIDER_ENV_TO_REQUEST_FIELD.items():
        if env_name in provider_updates:
            continue
        if request_field in updates:
            set_runtime_provider_value(env_name, updates[request_field])

    return ProviderSettingsResponse(
        providers=provider_statuses(),
        configured_env=configured_provider_env_names(),
        runtime_settings_enabled=runtime_provider_settings_enabled(),
        session_id=current_provider_session(),
        message=(
            "Provider settings saved for this browser session. "
            "Keys are not returned to the browser and are not written to disk."
        ),
    )


def provider_value(env_name: str, default: str = "") -> str:
    session_id = current_provider_session()
    with RUNTIME_PROVIDER_LOCK:
        session_settings = RUNTIME_PROVIDER_SETTINGS.get(session_id, {})
        runtime_value = session_settings.get(env_name)
    if runtime_value is not None:
        return runtime_value
    if session_id != DEFAULT_RUNTIME_SESSION and session_settings and env_name in PROVIDER_ENV_TO_REQUEST_FIELD:
        return default
    return os.getenv(env_name, default)


def set_runtime_provider_value(env_name: str, value: str | None) -> None:
    clean_value = (value or "").strip()
    session_id = current_provider_session()
    with RUNTIME_PROVIDER_LOCK:
        session_settings = RUNTIME_PROVIDER_SETTINGS.setdefault(session_id, {})
        if clean_value:
            session_settings[env_name] = clean_value
        else:
            session_settings.pop(env_name, None)
        if not session_settings:
            RUNTIME_PROVIDER_SETTINGS.pop(session_id, None)


def clear_runtime_provider_session() -> None:
    with RUNTIME_PROVIDER_LOCK:
        RUNTIME_PROVIDER_SETTINGS.pop(current_provider_session(), None)


def configured_provider_env_names() -> list[str]:
    names = sorted(PROVIDER_ENV_TO_REQUEST_FIELD)
    return [name for name in names if provider_value(name, "").strip()]


def runtime_provider_settings_enabled() -> bool:
    value = os.getenv("ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS", "enabled").strip().lower()
    return value not in {"0", "false", "no", "off", "disabled"}


def current_provider_session() -> str:
    return CURRENT_PROVIDER_SESSION.get() or DEFAULT_RUNTIME_SESSION


def set_current_provider_session(session_id: str | None) -> Token[str]:
    return CURRENT_PROVIDER_SESSION.set(normalize_provider_session(session_id))


def reset_current_provider_session(token: Token[str]) -> None:
    CURRENT_PROVIDER_SESSION.reset(token)


def normalize_provider_session(session_id: str | None) -> str:
    clean_value = "".join(
        char for char in (session_id or "").strip() if char.isalnum() or char in {"_", "-"}
    )
    if not clean_value:
        return DEFAULT_RUNTIME_SESSION
    return clean_value[:80]
