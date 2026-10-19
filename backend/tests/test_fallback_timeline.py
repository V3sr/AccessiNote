"""Videos with no slide images: the fallback timeline has no slide text, so nothing counts it as slide text.

Run from the repo root: python -m unittest discover -s backend/tests -t backend
"""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from typing import get_args
from unittest import mock

from app import generator, storage, video_processor
from app.models import LectureTimeline, OutputMode


# The status lines the fallback timeline used to put in each part's slide text list.
OLD_STATUS_LINES = (
    "No keyframes were available for OCR scanning.",
    "ffmpeg not available; OCR scan could not run.",
)
CAPTIONS = "The sample mean estimates the population mean. Larger samples give a steadier estimate of it."


def process_broken_video(transcript_hint: str = "", ffmpeg_path: str | None = None) -> video_processor.VideoProcessingResult:
    # A text file renamed to .mp4, like the local repro. Without ffmpeg the scan stops at once;
    # with ffmpeg it reads no frames, so the frame tools are faked to say so.
    with tempfile.TemporaryDirectory() as folder:
        video_path = Path(folder) / "broken.mp4"
        video_path.write_text("not a video", encoding="utf-8")
        no_transcript = video_processor.TranscriptResult(segments=[], warnings=[], engine="none")
        with (
            mock.patch.object(video_processor, "find_ffmpeg", return_value=ffmpeg_path),
            mock.patch.object(video_processor, "transcribe_video_to_segments", return_value=no_transcript),
            mock.patch.object(video_processor, "parse_video_duration", return_value=None),
            mock.patch.object(video_processor, "detect_scene_change_selections", return_value=[]),
            mock.patch.object(video_processor, "extract_keyframes", return_value=[]),
        ):
            return video_processor.process_video_to_timeline(
                "Broken video", video_path, Path(folder) / "outputs", transcript_hint=transcript_hint
            )


def fallback_timelines() -> dict[str, video_processor.VideoProcessingResult]:
    return {
        "no ffmpeg": process_broken_video(),
        "no ffmpeg, captions attached": process_broken_video(CAPTIONS),
        "no frames": process_broken_video(ffmpeg_path="ffmpeg"),
        "no frames, captions attached": process_broken_video(CAPTIONS, ffmpeg_path="ffmpeg"),
    }


class FallbackTimelineTest(unittest.TestCase):
    def test_parts_have_no_slide_text(self) -> None:
        for case, result in fallback_timelines().items():
            with self.subTest(case):
                self.assertTrue(result.timeline.chunks)
                for chunk in result.timeline.chunks:
                    self.assertEqual(chunk.ocr, [])
                    self.assertEqual(chunk.ocr_confidence, 0.0)
                    self.assertIn("missing frame evidence", chunk.evidence_flags)

    def test_why_the_scan_did_not_run_is_kept(self) -> None:
        for case, result in fallback_timelines().items():
            with self.subTest(case):
                self.assertTrue(result.warnings)
                self.assertTrue(result.timeline.processing_metadata.warnings)
                for chunk in result.timeline.chunks:
                    self.assertTrue(chunk.visual_description)


class RecentDraftsCountTest(unittest.TestCase):
    def test_fallback_draft_counts_no_slide_text(self) -> None:
        for case, result in fallback_timelines().items():
            with self.subTest(case), tempfile.TemporaryDirectory() as outputs_dir:
                with mock.patch.object(storage, "OUTPUTS_DIR", Path(outputs_dir)):
                    storage.save_timeline(result.timeline)
                    (summary,) = storage.list_saved_timelines()
                self.assertEqual(summary.chunk_count, len(result.timeline.chunks))
                self.assertEqual(summary.ocr_chunk_count, 0)


class GeneratedNotesTest(unittest.TestCase):
    def test_notes_hold_no_fake_slide_text(self) -> None:
        for case, result in fallback_timelines().items():
            timeline: LectureTimeline = result.timeline
            with self.subTest(case):
                self.assertFalse(any(generator.has_ocr_evidence(chunk) for chunk in timeline.chunks))
                # What Azure OpenAI would get as slide text, built locally; nothing is sent.
                payload = generator.azure_generation_payload(timeline)
                self.assertEqual([chunk["ocr"] for chunk in payload["chunks"] if chunk["ocr"]], [])
                with mock.patch.object(generator, "should_use_azure_generation", return_value=False):
                    for mode in get_args(OutputMode):
                        content = generator.generate_output(timeline, mode).content_markdown
                        for line in OLD_STATUS_LINES:
                            self.assertNotIn(line, content, mode)


if __name__ == "__main__":
    unittest.main()
