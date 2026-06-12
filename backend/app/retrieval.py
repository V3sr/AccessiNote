from __future__ import annotations

import hashlib
import re
from collections import Counter
from datetime import datetime, timezone

from .models import LectureTimeline, SourceInfo, TimelineChunk


STOPWORDS = {
    "about",
    "after",
    "again",
    "also",
    "because",
    "being",
    "basically",
    "course",
    "could",
    "decisions",
    "every",
    "everyone",
    "first",
    "from",
    "going",
    "great",
    "have",
    "into",
    "little",
    "let's",
    "just",
    "like",
    "maybe",
    "more",
    "most",
    "okay",
    "other",
    "over",
    "really",
    "right",
    "robert",
    "same",
    "some",
    "than",
    "that",
    "their",
    "then",
    "there",
    "these",
    "they",
    "this",
    "those",
    "thoughts",
    "through",
    "today",
    "using",
    "want",
    "what",
    "when",
    "where",
    "which",
    "while",
    "with",
    "would",
    "lecture",
    "student",
    "students",
    "instructor",
    "yeah",
    "youre",
}


def create_timeline_from_transcript(title: str, transcript: str) -> LectureTimeline:
    clean_title = title.strip() or "Untitled Lecture"
    clean_transcript = normalize_whitespace(transcript)
    seed = hashlib.sha1(f"{clean_title}:{clean_transcript}".encode("utf-8")).hexdigest()[:8]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    lecture_id = f"lecture_{timestamp}_{seed}"

    chunks = []
    current_start = 0
    for index, chunk_text in enumerate(split_transcript(clean_transcript), start=1):
        word_count = len(chunk_text.split())
        duration = max(45, min(180, word_count * 2))
        concepts = extract_concepts(chunk_text)
        chunks.append(
            TimelineChunk(
                chunk_id=f"c{index}",
                start=format_timestamp(current_start),
                end=format_timestamp(current_start + duration),
                transcript=chunk_text,
                ocr=[
                    "Pasted transcript only; no OCR source was provided.",
                    f"Detected terms: {', '.join(concepts)}",
                ],
                visual_description=(
                    "No visual track was provided with this pasted transcript. "
                    "Review slides, board work, or diagrams separately if they matter for access."
                ),
                concepts=concepts,
                source_confidence=0.72,
                keyframe_path="",
            )
        )
        current_start += duration

    return LectureTimeline(
        lecture_id=lecture_id,
        title=clean_title,
        source=SourceInfo(
            type="transcript",
            attribution="Pasted transcript provided locally by the user.",
            license="User-provided permitted material",
            url="",
        ),
        chunks=chunks,
    )


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_transcript(transcript: str, target_words: int = 85) -> list[str]:
    if not transcript:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", transcript)
    chunks: list[str] = []
    current: list[str] = []
    current_words = 0

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        sentence_words = len(sentence.split())
        if current and current_words + sentence_words > target_words:
            chunks.append(" ".join(current))
            current = []
            current_words = 0
        current.append(sentence)
        current_words += sentence_words

    if current:
        chunks.append(" ".join(current))

    if len(chunks) == 1 and len(chunks[0].split()) > target_words * 2:
        words = chunks[0].split()
        return [" ".join(words[i : i + target_words]) for i in range(0, len(words), target_words)]

    return chunks


def extract_concepts(text: str, limit: int = 5) -> list[str]:
    words = [
        word.lower().replace("’", "'")
        for word in re.findall(r"[A-Za-z][A-Za-z'-]{3,}", text)
        if word.lower().replace("’", "'") not in STOPWORDS
    ]
    counts = Counter(words)
    concepts = [word for word, _ in counts.most_common(limit)]
    return concepts or ["main idea"]


def format_timestamp(total_seconds: int) -> str:
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02}:{minutes:02}:{seconds:02}"
