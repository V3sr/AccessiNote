"""Key phrases in local study packs.

Run from the repo root: python -m unittest discover -s backend/tests -t backend
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from app.generator import build_adhd_study_pack, concept_phrase, key_phrases, top_concepts
from app.models import LectureTimeline, SourceInfo, TimelineChunk


SAMPLE_TIMELINE = Path(__file__).resolve().parents[2] / "data" / "samples" / "sample_lecture_timeline.json"

# The OCR text of the photosynthesis slide used in the 2026-10-18 review, as image_processor joins it.
PHOTOSYNTHESIS_SLIDE = (
    "Photosynthesis. Light energy becomes chemical energy. Inputs: water, carbon dioxide, light. "
    "Outputs: glucose and oxygen. Happens in the chloroplast."
)

VIDEO_PLACEHOLDER = (
    "Video keyframe extracted locally. No audio transcription provider is configured, "
    "so transcript text is not available for this timestamp."
)

IMAGE_PLACEHOLDER = (
    "Still image uploaded locally. No audio transcription is attached; use OCR text and human review "
    "to describe slide, board, or screenshot content."
)


def chunk(transcript: str, ocr: list[str] | None = None, chunk_id: str = "c1") -> TimelineChunk:
    return TimelineChunk(chunk_id=chunk_id, start="00:00:00", end="00:00:30", transcript=transcript, ocr=ocr or [])


def timeline(*chunks: TimelineChunk) -> LectureTimeline:
    return LectureTimeline(
        lecture_id="lecture_test",
        title="Test lecture",
        source=SourceInfo(type="image"),
        chunks=list(chunks),
    )


def two_word_phrases(text: str) -> list[str]:
    return [phrase for phrase in key_phrases(text) if " " in phrase]


class TwoWordPhrasesTest(unittest.TestCase):
    def test_phrases_do_not_cross_sentence_lines(self) -> None:
        phrases = two_word_phrases(PHOTOSYNTHESIS_SLIDE)
        self.assertNotIn("photosynthesis light", phrases, phrases)
        self.assertNotIn("glucose oxygen", phrases, phrases)

    def test_phrases_do_not_cross_commas(self) -> None:
        phrases = two_word_phrases(PHOTOSYNTHESIS_SLIDE)
        self.assertNotIn("water carbon", phrases, phrases)
        self.assertNotIn("dioxide light", phrases, phrases)

    def test_phrases_do_not_join_words_across_a_skipped_word(self) -> None:
        # "and" is too short to be a concept, so it used to vanish and leave "direction size".
        phrases = two_word_phrases("Vectors describe direction and size.")
        self.assertNotIn("direction size", phrases, phrases)

    def test_phrases_drop_filler_verbs(self) -> None:
        phrases = two_word_phrases(PHOTOSYNTHESIS_SLIDE + " Chlorophyll captures light. Vectors describe direction.")
        for bad in ["energy becomes", "becomes chemical", "chlorophyll captures", "captures light", "vectors describe"]:
            self.assertNotIn(bad, phrases, phrases)

    def test_phrases_drop_verbs_after_a_helper_verb(self) -> None:
        phrases = two_word_phrases("Matrices can transform vectors.")
        self.assertNotIn("transform vectors", phrases, phrases)

    def test_phrases_drop_adverbs(self) -> None:
        phrases = two_word_phrases("Caption file support works locally, AccessiNote should turn it into notes.")
        for bad in ["support works", "works locally", "locally accessinote", "accessinote should"]:
            self.assertNotIn(bad, phrases, phrases)

    def test_real_two_word_terms_are_kept(self) -> None:
        phrases = two_word_phrases(PHOTOSYNTHESIS_SLIDE)
        for good in ["light energy", "chemical energy", "carbon dioxide"]:
            self.assertIn(good, phrases, phrases)
        self.assertIn("receptor proteins", two_word_phrases("The lecture explains receptor proteins, signal cascades."))
        self.assertIn("fourier transform", two_word_phrases("The Fourier transform splits a signal into waves."))


class TopConceptsTest(unittest.TestCase):
    def test_demo_slide_names_its_terms(self) -> None:
        concepts = top_concepts([chunk(PHOTOSYNTHESIS_SLIDE)], limit=5)
        for good in ["photosynthesis", "light energy", "chemical energy", "carbon dioxide"]:
            self.assertIn(good, concepts, concepts)
        for bad in ["photosynthesis light", "energy becomes", "becomes chemical"]:
            self.assertNotIn(bad, concepts, concepts)

    def test_a_run_of_three_words_gives_one_phrase_not_two_overlapping_ones(self) -> None:
        concepts = top_concepts([chunk("Study in shorter focused rounds.")], limit=5)
        self.assertFalse({"shorter focused", "focused rounds"} <= set(concepts), concepts)
        concepts = top_concepts([chunk("Exam review keywords.")], limit=5)
        self.assertFalse({"exam review", "review keywords"} <= set(concepts), concepts)

    def test_phrases_from_different_sentences_can_share_a_word(self) -> None:
        concepts = top_concepts([chunk("Kinetic energy is the energy of motion. Energy conservation links the two.")], limit=5)
        self.assertIn("kinetic energy", concepts, concepts)
        self.assertIn("energy conservation", concepts, concepts)

    def test_function_words_are_not_concepts(self) -> None:
        # Modeled on the 72-chunk game theory recording, where "here", "when" and "might" reached Key Definitions.
        text = (
            "Here is the lottery. When you might pick it, here the probability matters. "
            "When the probability is low, you might skip the lottery here."
        )
        concepts = top_concepts([chunk(text)], limit=8)
        for bad in ["here", "when", "might"]:
            self.assertNotIn(bad, concepts, concepts)
        self.assertIn("lottery", concepts, concepts)
        self.assertIn("probability", concepts, concepts)

    def test_video_placeholder_is_not_a_concept_source(self) -> None:
        concepts = top_concepts([chunk(VIDEO_PLACEHOLDER, ocr=["Cell signaling", "Receptor proteins and ligands"])], limit=5)
        for bad in ["video keyframe", "keyframe locally", "audio transcription", "transcription provider"]:
            self.assertNotIn(bad, concepts, concepts)
        self.assertIn("cell signaling", concepts, concepts)
        self.assertIn("receptor proteins", concepts, concepts)

    def test_image_placeholder_is_not_a_concept_source(self) -> None:
        concepts = top_concepts([chunk(IMAGE_PLACEHOLDER, ocr=["OCR engine ran, but no readable text was detected in this frame."])])
        for bad in ["still image", "image uploaded", "uploaded locally", "audio transcription"]:
            self.assertNotIn(bad, concepts, concepts)

    def test_sample_lecture_keeps_its_glossary_terms(self) -> None:
        sample = LectureTimeline(**json.loads(SAMPLE_TIMELINE.read_text(encoding="utf-8")))
        self.assertEqual(
            concept_phrase(sample.chunks),
            "basis vectors, matrices, standard basis, linear structure, and magnitude",
        )


class StudyPackTest(unittest.TestCase):
    def test_demo_slide_study_pack_reads_as_terms(self) -> None:
        pack = build_adhd_study_pack(timeline(chunk(PHOTOSYNTHESIS_SLIDE)))
        big_idea = next(line for line in pack.splitlines() if line.startswith("- This lecture is mostly about"))
        for bad in ["Photosynthesis Light", "Energy Becomes", "Becomes Chemical"]:
            self.assertNotIn(bad, pack, big_idea)
        for good in ["photosynthesis", "light energy", "chemical energy", "carbon dioxide"]:
            self.assertIn(good, big_idea, big_idea)
        self.assertIn("- **Carbon Dioxide** (00:00:00-00:00:30): Inputs: water, carbon dioxide, light.", pack)


if __name__ == "__main__":
    unittest.main()
