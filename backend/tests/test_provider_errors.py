"""Azure provider failures: students see a plain sentence, the server log keeps the detail.

Run from the repo root: python -m unittest discover -s backend/tests -t backend
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app import generator, video_processor
from app.models import LectureTimeline, ProviderStatus, SourceInfo, TimelineChunk
from app.video_processor import OcrResult, TranscriptResult


# The 2026-10-18 Azure claim check (step 6) showed the endpoint host inside the student warning.
FAKE_HOST = "accessinote-demo.cognitiveservices.azure.com"
PROVIDER_ERROR = RuntimeError(f"HTTPSConnection(host='{FAKE_HOST}', port=443): Failed to establish a new connection")


def timeline() -> LectureTimeline:
    return LectureTimeline(
        lecture_id="lecture_test",
        title="Test lecture",
        source=SourceInfo(type="transcript"),
        chunks=[
            TimelineChunk(
                chunk_id="c1",
                start="00:00:00",
                end="00:00:30",
                transcript="Photosynthesis turns light energy into chemical energy in the chloroplast.",
            )
        ],
    )


class ProviderErrorTest(unittest.TestCase):
    def assert_plain_warning(self, warnings: list[str], expected: str) -> None:
        self.assertIn(expected, warnings)
        for warning in warnings:
            self.assertNotIn(FAKE_HOST, warning)
            self.assertNotIn("Detail", warning)

    def assert_logged_detail(self, log_lines: list[str]) -> None:
        self.assertTrue(any(FAKE_HOST in line for line in log_lines), log_lines)

    def test_azure_openai_failure_hides_detail_from_students(self) -> None:
        configured = ProviderStatus(name="azure_openai", enabled=True, configured=True)
        with (
            mock.patch.object(generator, "selected_provider", return_value="azure_openai"),
            mock.patch.object(generator, "provider_status", return_value=configured),
            mock.patch.object(generator, "generate_markdown_with_azure_openai", side_effect=PROVIDER_ERROR),
            self.assertLogs("app.generator", level="WARNING") as logs,
        ):
            response = generator.generate_output(timeline(), "structured_notes")

        self.assert_plain_warning(
            response.warnings, "Azure OpenAI generation failed; local deterministic fallback was used."
        )
        self.assertNotIn(FAKE_HOST, response.content_markdown)
        self.assert_logged_detail(logs.output)

    def test_azure_vision_failure_hides_detail_from_students(self) -> None:
        local = OcrResult(lines=["Photosynthesis"], confidence=0.9, engine="rapidocr")
        with (
            mock.patch.object(video_processor, "run_azure_vision_ocr", side_effect=PROVIDER_ERROR),
            mock.patch.object(video_processor, "run_local_ocr", return_value=local),
            self.assertLogs("app.video_processor", level="WARNING") as logs,
        ):
            result, warning = video_processor.run_configured_ocr(
                Path("frame_0001.jpg"), tesseract_path=None, prefer_rapidocr=True, prefer_azure=True
            )

        self.assertEqual(result, local)
        self.assert_plain_warning(
            [warning], "Azure AI Vision OCR failed on at least one frame; local OCR fallback was used."
        )
        self.assert_logged_detail(logs.output)

    def test_azure_speech_failure_hides_detail_from_students(self) -> None:
        local = TranscriptResult(segments=[], warnings=[], engine="faster-whisper")
        with (
            tempfile.TemporaryDirectory() as frames_dir,
            mock.patch.object(video_processor, "extract_audio_for_transcription", return_value=True),
            mock.patch.object(video_processor, "transcribe_audio_with_azure_speech", side_effect=PROVIDER_ERROR),
            mock.patch.object(video_processor, "transcribe_video_with_local_whisper", return_value=local),
            self.assertLogs("app.video_processor", level="WARNING") as logs,
        ):
            result = video_processor.transcribe_video_with_azure_speech(
                Path("lecture.mp4"), Path(frames_dir), ffmpeg_path="ffmpeg"
            )

        self.assert_plain_warning(result.warnings, "Azure Speech transcription failed; local fallback was used.")
        self.assert_logged_detail(logs.output)


if __name__ == "__main__":
    unittest.main()
