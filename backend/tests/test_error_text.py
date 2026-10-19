"""Unexpected local errors: students see a plain sentence, the server log keeps the detail.

Run from the repo root: python -m unittest discover -s backend/tests -t backend
"""

from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app import main, video_processor
from app.models import ProcessingJob


# A local path like the ones a crashed helper or a missing file puts in its error text.
# Forward slashes, because CalledProcessError quotes its command with repr and doubles backslashes.
FAKE_PATH = "C:/Users/student/Videos/private-lecture/transcription_audio.wav"


def assert_logged(test: unittest.TestCase, log_lines: list[str]) -> None:
    test.assertTrue(any(FAKE_PATH in line for line in log_lines), log_lines)


class FailedJobTest(unittest.TestCase):
    def test_failed_job_shows_a_plain_sentence(self) -> None:
        job = ProcessingJob(job_id="job_test", kind="image")
        payload = main.MediaJobPayload(
            job_id="job_test", kind="image", title="Slide", upload_path=Path("slide.png"), transcript_text=""
        )
        error = FileNotFoundError(f"[Errno 2] No such file or directory: '{FAKE_PATH}'")
        with (
            mock.patch.dict(main.MEDIA_JOBS, {"job_test": job}),
            mock.patch.object(main, "process_image_to_timeline", side_effect=error),
            self.assertLogs("app.main", level="ERROR") as logs,
        ):
            main.run_media_job(payload)
            failed = main.MEDIA_JOBS["job_test"]

        self.assertEqual(failed.status, "failed")
        self.assertEqual(failed.error, "Processing failed.")
        # The job is what GET /api/jobs returns to the browser.
        self.assertNotIn(FAKE_PATH, failed.model_dump_json())
        assert_logged(self, logs.output)


class LocalCaptionErrorTest(unittest.TestCase):
    def test_local_caption_failure_shows_a_plain_sentence(self) -> None:
        error = subprocess.CalledProcessError(1, ["python", "-c", "transcribe", FAKE_PATH])
        with (
            tempfile.TemporaryDirectory() as frames_dir,
            mock.patch.object(video_processor, "faster_whisper_available", return_value=True),
            mock.patch.object(video_processor, "extract_audio_for_transcription", return_value=True),
            mock.patch.object(video_processor, "run_whisper_subprocess", side_effect=error),
            self.assertLogs("app.video_processor", level="WARNING") as logs,
        ):
            result = video_processor.transcribe_video_with_local_whisper(
                Path("lecture.mp4"), Path(frames_dir), ffmpeg_path="ffmpeg"
            )

        # These warnings end up in processing_metadata.warnings, the saved draft JSON and the export.
        self.assertEqual(result.warnings, ["Local caption generation failed."])
        assert_logged(self, logs.output)


if __name__ == "__main__":
    unittest.main()
