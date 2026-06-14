from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass
class AzureOcrResult:
    lines: list[str]
    confidence: float
    engine: str = "azure_vision"


@dataclass
class AzureSpeechSegment:
    start_seconds: int
    end_seconds: int
    text: str


def generate_markdown_with_azure_openai(
    *,
    mode: str,
    title: str,
    timeline_payload: dict[str, Any],
    local_draft: str,
) -> str:
    from openai import OpenAI

    endpoint = require_env("AZURE_OPENAI_ENDPOINT")
    deployment = require_env("AZURE_OPENAI_DEPLOYMENT")
    api_key = require_env("AZURE_OPENAI_API_KEY")
    client = OpenAI(base_url=azure_openai_base_url(endpoint), api_key=api_key)
    response = client.responses.create(
        model=deployment,
        input=[
            {
                "role": "system",
                "content": (
                    "You are AccessiNote, an accessibility-first lecture assistant. "
                    "Create concise, source-grounded Markdown for students and accessibility reviewers. "
                    "Do not invent facts. Preserve timestamps and chunk ids when making claims. "
                    "Keep source coverage compact and tell the user to review uncertain evidence."
                ),
            },
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "requested_mode": mode,
                        "lecture_title": title,
                        "timeline_evidence": timeline_payload,
                        "local_deterministic_draft": local_draft,
                        "instructions": [
                            "Return Markdown only.",
                            "Improve usefulness and clarity without adding unsupported facts.",
                            "For ADHD output, reduce cognitive load and include a short start path.",
                            "For screen-reader output, use a linear reading order and clear visual descriptions.",
                            "For quality reports, keep scores and review warnings explicit.",
                        ],
                    },
                    ensure_ascii=True,
                ),
            },
        ],
    )
    content = getattr(response, "output_text", "") or ""
    return content.strip()


def run_azure_vision_ocr(image_path: Path) -> AzureOcrResult:
    from azure.ai.vision.imageanalysis import ImageAnalysisClient
    from azure.ai.vision.imageanalysis.models import VisualFeatures
    from azure.core.credentials import AzureKeyCredential

    endpoint = require_env("AZURE_VISION_ENDPOINT")
    key = require_env("AZURE_VISION_KEY")
    client = ImageAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
    result = client.analyze(image_data=image_path.read_bytes(), visual_features=[VisualFeatures.READ])
    lines: list[str] = []
    scores: list[float] = []
    read_result = getattr(result, "read", None)
    for block in getattr(read_result, "blocks", []) or []:
        for line in getattr(block, "lines", []) or []:
            text = normalize_space(str(getattr(line, "text", "")))
            if text and text not in lines:
                lines.append(text)
            word_scores = [
                float(getattr(word, "confidence", 0.0))
                for word in (getattr(line, "words", []) or [])
                if getattr(word, "confidence", None) is not None
            ]
            if word_scores:
                scores.append(sum(word_scores) / len(word_scores))
    confidence = sum(scores) / len(scores) if scores else (0.8 if lines else 0.0)
    return AzureOcrResult(lines=lines[:16], confidence=round(confidence, 3))


def transcribe_audio_with_azure_speech(audio_path: Path, timeout_seconds: int) -> list[AzureSpeechSegment]:
    import azure.cognitiveservices.speech as speechsdk

    speech_key = require_env("AZURE_SPEECH_KEY")
    speech_region = require_env("AZURE_SPEECH_REGION")
    language = os.getenv("AZURE_SPEECH_LANGUAGE", "en-US").strip() or "en-US"
    speech_config = speechsdk.SpeechConfig(subscription=speech_key, region=speech_region)
    speech_config.speech_recognition_language = language
    speech_config.output_format = speechsdk.OutputFormat.Detailed
    audio_config = speechsdk.audio.AudioConfig(filename=str(audio_path))
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)

    done = threading.Event()
    segments: list[AzureSpeechSegment] = []
    errors: list[str] = []

    def recognized(event: Any) -> None:
        result = event.result
        if result.reason == speechsdk.ResultReason.RecognizedSpeech and result.text:
            start_seconds = max(0, int(result.offset / 10_000_000))
            duration_seconds = max(1, int(result.duration / 10_000_000))
            segments.append(
                AzureSpeechSegment(
                    start_seconds=start_seconds,
                    end_seconds=start_seconds + duration_seconds,
                    text=normalize_space(result.text),
                )
            )

    def canceled(event: Any) -> None:
        details = speechsdk.CancellationDetails(event.result)
        errors.append(str(getattr(details, "error_details", "") or getattr(details, "reason", "")))
        done.set()

    def stopped(_event: Any) -> None:
        done.set()

    recognizer.recognized.connect(recognized)
    recognizer.canceled.connect(canceled)
    recognizer.session_stopped.connect(stopped)
    recognizer.start_continuous_recognition()
    finished = done.wait(timeout=max(1, timeout_seconds))
    recognizer.stop_continuous_recognition()
    if not finished:
        raise TimeoutError("Azure Speech transcription timed out.")
    if errors and not segments:
        raise RuntimeError(errors[0])
    return segments


def azure_openai_base_url(endpoint: str) -> str:
    normalized = endpoint.strip().rstrip("/")
    if normalized.endswith("/openai/v1"):
        return f"{normalized}/"
    return f"{normalized}/openai/v1/"


def normalize_space(value: str) -> str:
    return " ".join(value.split())


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is not configured.")
    return value
