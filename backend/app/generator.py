from __future__ import annotations

from collections import Counter
import json
import re

from .models import CaptionSegment, GenerateResponse, LectureTimeline, OutputMode, SourceReference, TimelineChunk
from .retrieval import extract_concepts


SAFETY_WARNING = (
    "AI-generated content may contain errors. Review before academic or accessibility use."
)

MODE_TITLES: dict[str, str] = {
    "structured_notes": "Structured Notes",
    "adhd_study_pack": "ADHD Study Pack",
    "screen_reader_notes": "Screen Reader Notes",
    "exam_prep_pack": "Exam Prep Pack",
    "plain_language": "Plain-Language Explanation",
    "notetaker_quality_report": "Notetaker Quality Report",
    "captions_vtt": "WebVTT Captions",
    "timeline_json": "Evidence Timeline JSON",
    "transcript_txt": "Plain Transcript",
}

DEFINITIONS: dict[str, str] = {
    "game theory": "the study of decisions where each person or group must account for what others may do",
    "economic applications": "ways these decision models are used to understand real choices, markets, or institutions",
    "strategic interaction": "a situation where one person's best choice depends on other people's choices",
    "players": "the decision-makers in a game or strategic situation",
    "strategy": "a complete plan for what a player will do in the situations they may face",
    "payoff": "the outcome or value a player gets from a set of choices",
    "dominant strategy": "a strategy that does at least as well as the alternatives no matter what others do",
    "nash equilibrium": "a stable set of strategies where no player wants to switch alone",
    "equilibrium": "a stable outcome where the incentives fit together",
    "utility": "a way to represent how much a person values an outcome",
    "expected utility": "the average utility of a risky option after weighting each outcome by its probability",
    "lottery": "a risky option with possible outcomes and probabilities",
    "probability": "how likely an outcome is to happen",
    "concave function": "a curve shape often used to model risk aversion, where extra gains add less value as wealth rises",
    "risk aversion": "preferring a safer option over a risky option with the same average value",
    "common knowledge": "information that everyone knows, and everyone knows that everyone knows",
    "vectors": "quantities that can represent direction, magnitude, movement, or features",
    "magnitude": "the size or length of a vector",
    "direction": "where a vector points",
    "matrices": "rectangular grids of numbers that can act on vectors",
    "matrix-vector multiplication": "the row-by-column process that produces a new vector",
    "linear transformation": "a rule that moves vectors while preserving linear structure",
    "rotation": "a transformation that turns vectors around a point",
    "scaling": "a transformation that stretches or shrinks vectors",
    "reflection": "a transformation that flips vectors across a line",
    "shear": "a transformation that slants space while keeping parallel lines parallel",
    "basis vectors": "reference vectors that describe the coordinate directions",
    "standard basis": "the usual x and y direction vectors in a coordinate plane",
    "columns of a matrix": "where the matrix sends the standard basis vectors",
    "linear structure": "relationships like lines through the origin and vector addition",
}

GENERIC_CONCEPTS = {
    "accessi",
    "about",
    "actually",
    "alright",
    "around",
    "basically",
    "begin",
    "being",
    "course",
    "decisions",
    "detected",
    "discussed",
    "each",
    "engine",
    "even",
    "everyone",
    "everything",
    "evidence",
    "extracted",
    "frame",
    "from",
    "going",
    "great",
    "guess",
    "happens",
    "important",
    "interactive",
    "it's",
    "its",
    "just",
    "let's",
    "little",
    "main",
    "maybe",
    "more",
    "note",
    "ocr",
    "okay",
    "people",
    "play",
    "readable",
    "really",
    "right",
    "robert",
    "something",
    "source",
    "start",
    "text",
    "that",
    "then",
    "thing",
    "things",
    "think",
    "this",
    "thoughts",
    "today",
    "transcript",
    "visual",
    "want",
    "we're",
    "were",
    "weve",
    "well",
    "what",
    "where",
    "will",
    "winner",
    "with",
    "youre",
    "you're",
}


def generate_output(timeline: LectureTimeline, mode: OutputMode) -> GenerateResponse:
    if mode not in MODE_TITLES:
        raise ValueError(f"Unsupported output mode: {mode}")

    builders = {
        "structured_notes": build_structured_notes,
        "adhd_study_pack": build_adhd_study_pack,
        "screen_reader_notes": build_screen_reader_notes,
        "exam_prep_pack": build_exam_prep_pack,
        "plain_language": build_plain_language,
        "notetaker_quality_report": build_notetaker_quality_report,
        "captions_vtt": build_webvtt_captions,
        "timeline_json": build_timeline_json,
        "transcript_txt": build_plain_transcript,
    }
    content = builders[mode](timeline)
    return GenerateResponse(
        lecture_id=timeline.lecture_id,
        mode=mode,
        title=MODE_TITLES[mode],
        content_markdown=content,
        sources=source_references(timeline, mode),
        warnings=[SAFETY_WARNING],
    )


def build_structured_notes(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return empty_output(timeline, "Structured Notes")

    focus_chunks = evidence_reference_chunks(timeline, limit=8)
    lines = [
        f"# Structured Notes: {timeline.title}",
        "",
        "## Overview",
        f"- Main focus: **{concept_phrase(chunks)}**.",
        f"- Built from {len(chunks)} timestamped chunk(s), {len(timeline.caption_segments)} caption segment(s), and local visual/OCR evidence.",
        "- Use the timestamps below to review the original material before relying on these notes.",
        "",
        "## Key Takeaways",
    ]
    for concept in top_concepts(chunks, limit=6):
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}** ({time_range(source)}): {definition_for(concept, chunks)}.")

    lines.extend(["", "## Guided Timeline"])
    for chunk in focus_chunks:
        lines.append(f"- **{time_range(chunk)}**: {chunk_takeaway(chunk)}")

    lines.extend(["", "## Key Definitions"])
    for concept in top_concepts(chunks, limit=8):
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}**: {definition_for(concept, chunks)} Source: **{time_range(source)}**.")

    example_chunks = example_or_high_signal_chunks(chunks, limit=4)
    lines.extend(["", "## Review Anchors"])
    for chunk in example_chunks:
        lines.append(
            f"- **{time_range(chunk)}**: {chunk_takeaway(chunk)}"
        )

    lines.extend(source_coverage_section(timeline, detail_limit=4))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_adhd_study_pack(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return "\n".join(
            [
                f"# ADHD Study Pack: {timeline.title}",
                "",
                "## Start Here",
                "- No timeline chunks were available. Upload a transcript, captions, image, or video first.",
            ]
        )

    focus_chunks = adhd_focus_chunks(timeline, limit=5)
    must_know = top_concepts(chunks, limit=5)
    first_checkpoint = focus_chunks[0]
    best_checkpoint = best_summary_chunk(focus_chunks)
    lines = [
        f"# ADHD Study Pack: {timeline.title}",
        "",
        "## 3-Minute Start",
        f"1. Open **{time_range(first_checkpoint)}** and read only the Big Idea below.",
        f"2. Then check **{time_range(best_checkpoint)}** for the clearest example or summary point.",
        "3. Stop there. Mark one confusing term instead of trying to finish the whole lecture.",
        "",
        "## Big Idea",
        f"- This lecture is mostly about **{concept_phrase(chunks)}**.",
        f"- The most useful first takeaway: {chunk_takeaway(first_checkpoint)}",
        "",
        "## Must Know, In Plain Words",
    ]
    for concept in must_know:
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}** ({time_range(source)}): {definition_for(concept, chunks)}.")

    lines.extend(
        [
            "",
            "## 10-Minute Focus Route",
            "- **0-2 min:** Read the Big Idea and the first two Must Know terms.",
            "- **2-6 min:** Visit the checkpoints below. Do not read every timestamp.",
            "- **6-8 min:** Write one sentence that connects two terms.",
            "- **8-10 min:** Answer one quick check. Stop when the timer ends.",
            "",
            "## Checkpoints To Visit",
        ]
    )
    for index, chunk in enumerate(focus_chunks, start=1):
        lines.append(f"- [ ] **{index}. {time_range(chunk)}** - {chunk_takeaway(chunk)}")

    lines.extend(
        [
            "",
            "## Quick Checks",
        ]
    )
    for question in adhd_quick_checks(chunks, must_know):
        lines.append(f"- {question}")

    lines.extend(
        [
            "",
            "## If You Are Overwhelmed",
            "- Pick **one** checkpoint and ignore the rest for now.",
            "- Copy only one Must Know term into your notes.",
            "- If a frame or OCR line looks wrong, trust the caption/transcript first and flag the frame for review.",
            "- Use `?` next to unclear terms instead of stopping the session.",
        ]
    )
    lines.extend(source_coverage_section(timeline, detail_limit=0))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_screen_reader_notes(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return empty_output(timeline, "Screen Reader Notes")

    focus_chunks = evidence_reference_chunks(timeline, limit=10)
    lines = [
        f"# Screen Reader Notes: {timeline.title}",
        "",
        "## Lecture Overview",
        f"This lecture covers **{concept_phrase(chunks)}**. Notes are linear, timestamped, and avoid tables so they work well in screen readers.",
        "",
        "## Essential Concepts",
    ]
    for concept in top_concepts(chunks, limit=6):
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}**, introduced around **{time_range(source)}**: {definition_for(concept, chunks)}.")

    lines.extend(
        [
            "",
            "## Timestamped Notes",
        ]
    )
    for chunk in focus_chunks:
        lines.extend(
            [
                f"### {time_range(chunk)}",
                chunk_takeaway(chunk),
                f"Source confidence: {percent_number(chunk.source_confidence)}.",
            ]
        )

    visual_chunks = [chunk for chunk in focus_chunks if chunk.visual_description]
    lines.extend(
        [
            "",
            "## Visual Content To Review",
        ]
    )
    for chunk in visual_chunks:
        lines.append(f"- **{time_range(chunk)}**: {chunk.visual_description}")

    ocr_chunks = [chunk for chunk in focus_chunks if has_ocr_evidence(chunk)]
    lines.extend(
        [
            "",
            "## Visible Text Or Symbols",
        ]
    )
    if ocr_chunks:
        for chunk in ocr_chunks[:6]:
            lines.append(f"- **{time_range(chunk)}**: {short_ocr_text(chunk)}")
    else:
        lines.append("- No reliable OCR text was detected in the selected review checkpoints.")

    lines.extend(source_coverage_section(timeline, detail_limit=3))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_exam_prep_pack(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return empty_output(timeline, "Exam Prep Pack")

    concepts = top_concepts(chunks, limit=8)
    focus_chunks = evidence_reference_chunks(timeline, limit=6)
    lines = [
        f"# Exam Prep Pack: {timeline.title}",
        "",
        "## What To Know First",
    ]
    for concept in concepts[:6]:
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}** ({time_range(source)}): {definition_for(concept, chunks)}.")

    lines.extend(["", "## Flashcards"])
    for concept in concepts[:6]:
        source = first_chunk_with_concept(chunks, concept)
        lines.extend(
            [
                f"- **Q:** Explain **{title_case(concept)}** in one sentence.",
                f"  **A:** {ensure_sentence(definition_for(concept, chunks))} Source: **{time_range(source)}**.",
            ]
        )

    lines.extend(["", "## Practice Prompts"])
    for chunk in focus_chunks[:5]:
        lines.append(f"- Using **{time_range(chunk)}**, explain why this matters: {chunk_takeaway(chunk)}")

    lines.extend(["", "## Common Mistakes To Avoid"])
    for mistake in common_mistakes_for(concepts):
        lines.append(f"- {mistake}")

    lines.extend(source_coverage_section(timeline, detail_limit=4))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_plain_language(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return empty_output(timeline, "Plain-Language Explanation")

    concepts = top_concepts(chunks, limit=6)
    focus_chunks = evidence_reference_chunks(timeline, limit=6)
    lines = [
        f"# Plain-Language Explanation: {timeline.title}",
        "",
        "## Big Idea",
        f"This lecture is about **{concept_phrase(chunks)}**. In plain language, it is trying to help you connect a few important ideas to the examples shown or spoken in the lecture.",
        "",
        "## Main Ideas Without Jargon",
    ]
    for concept in concepts[:5]:
        source = first_chunk_with_concept(chunks, concept)
        lines.append(f"- **{title_case(concept)}** ({time_range(source)}): {definition_for(concept, chunks)}.")

    lines.extend(["", "## Follow The Lecture In Six Stops"])
    for chunk in focus_chunks:
        lines.append(f"- **{time_range(chunk)}**: {simplify_sentence(chunk_takeaway(chunk), limit=170)}")

    lines.extend(
        [
            "",
            "## What To Do If It Still Feels Confusing",
            "- Pick one timestamp above and replay only that section.",
            "- Write one term and one example beside it.",
            "- If OCR or visual evidence looks wrong, use the transcript as the first source and mark the frame for review.",
        ]
    )
    lines.extend(source_coverage_section(timeline, detail_limit=3))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_notetaker_quality_report(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    if not chunks:
        return empty_output(timeline, "Notetaker Quality Report")

    metrics = timeline.processing_metadata.metrics
    transcript_score = 100 if metrics.transcript_segment_count > 0 else 35
    ocr_score = int((metrics.ocr_frame_count / max(1, metrics.extracted_frame_count)) * 100) if metrics.extracted_frame_count else 0
    confidence_score = int(sum(chunk.source_confidence for chunk in chunks) / max(1, len(chunks)) * 100)
    weak_penalty = min(25, metrics.weak_chunk_count * 4)
    overall = max(0, min(100, round((transcript_score * 0.35) + (ocr_score * 0.2) + (confidence_score * 0.35) + 10 - weak_penalty)))

    lines = [
        f"# Notetaker Quality Report: {timeline.title}",
        "",
        "## Overall Readiness",
        f"- Overall review readiness: **{overall}/100**.",
        f"- Transcript/caption evidence: **{transcript_score}/100**.",
        f"- OCR coverage: **{ocr_score}/100**.",
        f"- Average source confidence: **{confidence_score}/100**.",
        f"- Weak evidence chunks: **{metrics.weak_chunk_count}**.",
        "",
        "## What Looks Strong",
    ]
    for strength in quality_strengths(timeline):
        lines.append(f"- {strength}")

    lines.extend(
        [
            "",
            "## What Needs Human Review",
        ]
    )
    for warning in quality_review_items(timeline):
        lines.append(f"- {warning}")

    lines.extend(
        [
            "",
            "## Accessibility Checklist",
            "- Confirm generated captions against the original audio before treating them as official transcript material.",
            "- Check OCR-heavy chunks for equations, names, and small slide text.",
            "- Keep the ADHD, screen-reader, and plain-language outputs as editable drafts, not final accommodations.",
            "- Preserve timestamps when moving notes into another tool so students can audit the source.",
        ]
    )
    lines.extend(source_coverage_section(timeline, detail_limit=5))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_webvtt_captions(timeline: LectureTimeline) -> str:
    segments = timeline.caption_segments or [
        CaptionSegment(start=chunk.start, end=chunk.end, text=chunk.transcript, source="timeline chunk")
        for chunk in timeline.chunks
    ]
    lines = [
        "WEBVTT",
        "",
        f"NOTE Generated locally by AccessiNote from {timeline.title}",
        "",
    ]
    for index, segment in enumerate(segments, start=1):
        caption_text = normalize_caption_text(segment.text)
        if not caption_text:
            continue
        lines.extend(
            [
                str(index),
                f"{to_vtt_timestamp(segment.start)} --> {to_vtt_timestamp(segment.end)}",
                caption_text,
                "",
            ]
        )
    return "\n".join(lines).strip() + "\n"


def build_timeline_json(timeline: LectureTimeline) -> str:
    if hasattr(timeline, "model_dump"):
        payload = timeline.model_dump()
    else:
        payload = timeline.dict()
    return json.dumps(payload, indent=2)


def build_plain_transcript(timeline: LectureTimeline) -> str:
    lines = [f"{timeline.title}", ""]
    if timeline.caption_segments:
        for segment in timeline.caption_segments:
            lines.append(f"[{segment.start}-{segment.end}] {segment.text}")
    else:
        for chunk in timeline.chunks:
            lines.append(f"[{time_range(chunk)}] {chunk.transcript}")
    return "\n".join(lines).strip() + "\n"


def source_references(timeline: LectureTimeline, mode: OutputMode) -> list[SourceReference]:
    limit = 6 if mode == "adhd_study_pack" else 10
    chunks = adhd_focus_chunks(timeline, limit=limit) if mode == "adhd_study_pack" else evidence_reference_chunks(timeline, limit=limit)
    return [
        SourceReference(
            chunk_id=chunk.chunk_id,
            start=chunk.start,
            end=chunk.end,
            reason=f"Used for: {chunk_takeaway(chunk)}",
        )
        for chunk in chunks
    ]


def source_coverage_section(timeline: LectureTimeline, detail_limit: int = 6) -> list[str]:
    metrics = timeline.processing_metadata.metrics
    lines = [
        "",
        "## Source Coverage",
        f"- Lecture source type: **{timeline.source.type}**.",
        f"- Generated from **{len(timeline.chunks)}** available timeline chunk(s).",
        f"- Visual scan: **{metrics.extracted_frame_count}** extracted frame(s) from **{metrics.candidate_frame_count}** candidate timestamp(s).",
        f"- OCR coverage: **{metrics.ocr_frame_count}** frame(s) with readable text using **{metrics.ocr_engine}**.",
        f"- Caption/transcript source: **{metrics.caption_source}** with **{metrics.transcript_segment_count}** segment(s).",
        f"- Weak evidence chunks flagged: **{metrics.weak_chunk_count}**.",
    ]
    if detail_limit <= 0:
        lines.append("- Full timestamp evidence is available in the timeline and Evidence JSON export.")
        return lines

    lines.extend(["", "### Evidence Samples"])
    for chunk in evidence_reference_chunks(timeline, limit=detail_limit):
        lines.append(
            f"- **{time_range(chunk)}** ({chunk.chunk_id}): {chunk_takeaway(chunk)}"
        )
    return lines


def safety_section() -> list[str]:
    return ["", "## Safety Note", f"- {SAFETY_WARNING}"]


def empty_output(timeline: LectureTimeline, title: str) -> str:
    return "\n".join(
        [
            f"# {title}: {timeline.title}",
            "",
            "## No Timeline Evidence",
            "- No transcript, caption, OCR, or frame evidence is available yet.",
            "- Upload permitted media, paste a transcript, or load the sample lecture before using this output.",
        ]
    )


def example_or_high_signal_chunks(chunks: list[TimelineChunk], limit: int = 4) -> list[TimelineChunk]:
    example_chunks = [
        chunk
        for chunk in chunks
        if "example" in chunk.transcript.lower()
        or any(marker in chunk.transcript.lower() for marker in ["for instance", "suppose", "probability", "payoff"])
    ]
    selected = example_chunks or sorted(
        chunks,
        key=lambda chunk: (learning_value_score(chunk), chunk.source_confidence),
        reverse=True,
    )
    return selected[:limit]


def short_ocr_text(chunk: TimelineChunk) -> str:
    useful = [item for item in chunk.ocr if has_ocr_evidence_text(item)]
    if not useful:
        return "No reliable OCR text was detected."
    return "; ".join(simplify_sentence(item, limit=90) for item in useful[:3])


def common_mistakes_for(concepts: list[str]) -> list[str]:
    concept_set = set(concepts)
    mistakes = []
    if "game theory" in concept_set:
        mistakes.append("Treating game theory as only games or competition; it is about strategic decisions.")
    if "expected utility" in concept_set or "utility" in concept_set:
        mistakes.append("Mixing up money, probability, and utility; expected utility weights value by likelihood.")
    if "lottery" in concept_set or "probability" in concept_set:
        mistakes.append("Ignoring the probability attached to each outcome.")
    if "matrix-vector multiplication" in concept_set or "linear transformation" in concept_set:
        mistakes.append("Memorizing formulas without checking what the transformation does visually.")
    if not mistakes:
        mistakes.extend(
            [
                "Memorizing terms without linking them to a timestamped example.",
                "Skipping visual/OCR evidence when slides or board work carry the key idea.",
                "Trusting generated notes without replaying unclear timestamps.",
            ]
        )
    return mistakes[:4]


def quality_strengths(timeline: LectureTimeline) -> list[str]:
    metrics = timeline.processing_metadata.metrics
    strengths = []
    if metrics.transcript_segment_count > 0:
        strengths.append(f"Captions/transcript evidence is present with {metrics.transcript_segment_count} segment(s).")
    if metrics.ocr_frame_count > 0:
        strengths.append(f"OCR found readable text in {metrics.ocr_frame_count} frame(s).")
    if metrics.extracted_frame_count > 0:
        strengths.append(f"Visual frame evidence is available from {metrics.extracted_frame_count} extracted frame(s).")
    if metrics.weak_chunk_count == 0:
        strengths.append("No weak evidence chunks were flagged by the local pipeline.")
    return strengths or ["The source was converted into a reviewable timeline, but evidence coverage is limited."]


def quality_review_items(timeline: LectureTimeline) -> list[str]:
    metrics = timeline.processing_metadata.metrics
    items = []
    if metrics.transcript_segment_count == 0:
        items.append("No caption/transcript evidence was found; generated notes may miss spoken context.")
    if metrics.extracted_frame_count == 0:
        items.append("No frames were extracted; visual slide or board content needs separate review.")
    if metrics.ocr_frame_count == 0:
        items.append("No readable OCR text was detected; check diagrams, slides, and board work manually.")
    if metrics.weak_chunk_count > 0:
        items.append(f"{metrics.weak_chunk_count} weak evidence chunk(s) need human review.")
    if not items:
        items.append("Review equations, names, and technical terms against the original lecture before sharing.")
    return items


def percent_number(value: float) -> str:
    return f"{round(max(0, min(1, value)) * 100)}%"


def ensure_sentence(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return ""
    if stripped[-1] in {".", "!", "?"}:
        return stripped
    return f"{stripped}."


def top_concepts(chunks: list[TimelineChunk], limit: int = 8) -> list[str]:
    counts: Counter[str] = Counter()
    for chunk in chunks:
        text = chunk.transcript
        for phrase in key_phrases(text):
            if phrase in DEFINITIONS:
                counts[phrase] += 8
            else:
                counts[phrase] += 3 if " " in phrase else 1
        for concept in extract_concepts(chunk.transcript, limit=8):
            clean = clean_concept(concept)
            if clean:
                counts[clean] += 1

    selected: list[str] = []
    for concept, _count in counts.most_common(limit * 4):
        if concept in selected:
            continue
        narrower_match = next((existing for existing in selected if concept in existing), "")
        if narrower_match:
            continue
        broader_match = next((existing for existing in selected if existing in concept), "")
        if broader_match and " " in concept:
            selected[selected.index(broader_match)] = concept
            continue
        if broader_match:
            continue
        selected.append(concept)
        if len(selected) >= limit:
            break
    return selected or ["main idea"]


def concept_phrase(chunks: list[TimelineChunk]) -> str:
    concepts = top_concepts(chunks, limit=5)
    if not concepts:
        return "the main lecture ideas"
    if len(concepts) == 1:
        return concepts[0]
    return ", ".join(concepts[:-1]) + f", and {concepts[-1]}"


def evidence_reference_chunks(timeline: LectureTimeline, limit: int = 6) -> list[TimelineChunk]:
    return select_reference_chunks(timeline.chunks, limit=limit)


def select_reference_chunks(chunks: list[TimelineChunk], limit: int = 6) -> list[TimelineChunk]:
    if len(chunks) <= limit:
        return chunks

    selected: list[TimelineChunk] = []

    def add(chunk: TimelineChunk) -> None:
        if chunk.chunk_id not in {item.chunk_id for item in selected}:
            selected.append(chunk)

    early_candidates = [chunk for chunk in chunks if timestamp_seconds(chunk.start) <= 600 and learning_value_score(chunk) > 0]
    if early_candidates:
        add(max(early_candidates, key=learning_value_score))
    else:
        add(chunks[0])

    high_signal = sorted(
        chunks,
        key=lambda chunk: (
            learning_value_score(chunk),
            len([item for item in chunk.ocr if has_ocr_evidence_text(item)]),
            chunk.source_confidence,
        ),
        reverse=True,
    )
    for chunk in high_signal:
        if len(selected) >= max(2, limit - 1):
            break
        if chunk_takeaway(chunk) != "Review this timestamp for context.":
            add(chunk)

    if learning_value_score(chunks[-1]) > 0:
        add(chunks[-1])
    if len(selected) < limit:
        stride = max(1, len(chunks) // limit)
        for index in range(stride, len(chunks), stride):
            if learning_value_score(chunks[index]) > 0:
                add(chunks[index])
            if len(selected) >= limit:
                break

    return sorted(selected[:limit], key=lambda chunk: timestamp_seconds(chunk.start))


def adhd_focus_chunks(timeline: LectureTimeline, limit: int = 5) -> list[TimelineChunk]:
    chunks = timeline.chunks
    if len(chunks) <= limit:
        return chunks

    scored = [
        (learning_value_score(chunk), chunk)
        for chunk in chunks
        if chunk_takeaway(chunk) != "Review this timestamp for context."
    ]
    scored = [item for item in scored if item[0] > 0]
    if not scored:
        return select_reference_chunks(chunks, limit=limit)

    selected: list[TimelineChunk] = []

    def add(chunk: TimelineChunk) -> None:
        if chunk.chunk_id not in {item.chunk_id for item in selected}:
            selected.append(chunk)

    early_candidates = [item for item in scored if timestamp_seconds(item[1].start) <= 600]
    if early_candidates:
        add(max(early_candidates, key=lambda item: item[0])[1])

    for _score, chunk in sorted(scored, key=lambda item: item[0], reverse=True):
        if len(selected) >= limit:
            break
        add(chunk)

    return sorted(selected[:limit], key=lambda chunk: timestamp_seconds(chunk.start))


def learning_value_score(chunk: TimelineChunk) -> float:
    text = clean_teaching_text(chunk.transcript)
    if not text or is_low_value_sentence(text):
        return 0
    words = meaningful_words(text)
    if len(words) < 4:
        return 0
    score = len(set(words)) + chunk.source_confidence * 4
    lower = text.lower()
    for term in DEFINITIONS:
        if term in lower:
            score += 8 if " " in term else 3
    if any(marker in lower for marker in ["example", "probability", "payoff", "strategy", "utility", "equilibrium", "prefer"]):
        score += 6
    if len(text) > 260:
        score -= 3
    return score


def best_summary_chunk(chunks: list[TimelineChunk]) -> TimelineChunk:
    return max(
        chunks,
        key=lambda chunk: (
            chunk.source_confidence,
            len(clean_teaching_text(chunk.transcript)),
            len([item for item in chunk.ocr if has_ocr_evidence_text(item)]),
        ),
    )


def chunk_takeaway(chunk: TimelineChunk) -> str:
    text = clean_teaching_text(chunk.transcript)
    if text:
        sentence = best_sentence(text)
        if sentence:
            return simplify_sentence(sentence, limit=150)

    useful_ocr = [item for item in chunk.ocr if has_ocr_evidence_text(item)]
    if useful_ocr:
        return f"Visible text to verify: {simplify_sentence(useful_ocr[0], limit=120)}."

    concepts = [concept for concept in (clean_concept(item) for item in chunk.concepts) if concept]
    if concepts:
        return f"Review how this timestamp introduces {', '.join(concepts[:2])}."
    return "Review this timestamp for context."


def adhd_quick_checks(chunks: list[TimelineChunk], concepts: list[str]) -> list[str]:
    checks = []
    for concept in concepts[:3]:
        source = first_chunk_with_concept(chunks, concept)
        checks.append(f"At **{time_range(source)}**, what does **{title_case(concept)}** change, explain, or help decide?")

    if chunks:
        best = best_summary_chunk(select_reference_chunks(chunks, limit=5))
        checks.append(f"After **{time_range(best)}**, write the idea in one sentence without copying the transcript.")
    return checks[:4]


def key_phrases(text: str) -> list[str]:
    lower = text.lower()
    phrases = [term for term in DEFINITIONS if " " in term and term in lower]
    words = meaningful_words(text)
    for index in range(0, max(0, len(words) - 1)):
        phrase_words = words[index : index + 2]
        phrase = " ".join(phrase_words)
        if is_useful_phrase(phrase):
            phrases.append(phrase)
    phrases.extend(words)
    return phrases


def meaningful_words(text: str) -> list[str]:
    words = []
    for raw_word in re.findall(r"[A-Za-z][A-Za-z'-]{2,}", text.lower()):
        clean = clean_concept(raw_word)
        if clean and " " not in clean:
            words.append(clean)
    return words


def is_useful_phrase(phrase: str) -> bool:
    parts = phrase.split()
    if len(parts) < 2:
        return False
    if any(part in GENERIC_CONCEPTS for part in parts):
        return False
    if "game" in parts and "theory" not in parts:
        return False
    if "applications" in parts and phrase != "economic applications":
        return False
    return len(set(parts)) == len(parts)


def clean_concept(concept: str) -> str:
    clean = concept.strip().lower().replace("\u2019", "'")
    clean = re.sub(r"[^a-z0-9' -]", "", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    if not clean or len(clean) < 4:
        return ""
    if clean in GENERIC_CONCEPTS:
        return ""
    if clean.endswith("'s"):
        clean = clean[:-2]
    if clean in GENERIC_CONCEPTS:
        return ""
    return clean


def clean_teaching_text(text: str) -> str:
    cleaned = re.sub(r"\b(um|uh|yeah|okay|alright)\b[,.]?\s*", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"^(great|right|so|now|well)[,.]?\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^(so\s+)?let'?s\s+(now\s+)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^let'?s\s+(now\s+)?", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^[?.,;:\s]+", "", cleaned)
    if "no audio transcription provider is configured" in cleaned.lower():
        return ""
    return cleaned.strip()


def best_sentence(text: str) -> str:
    candidates = [sentence.strip() for sentence in re.split(r"(?<=[.!?])\s+", text) if sentence.strip()]
    scored = []
    for sentence in candidates:
        clean = clean_teaching_text(sentence)
        if is_low_value_sentence(clean):
            continue
        words = meaningful_words(clean)
        if len(words) < 3:
            continue
        scored.append((len(words), len(clean), clean))
    if not scored:
        cleaned = clean_teaching_text(text)
        return "" if is_low_value_sentence(cleaned) else cleaned
    return sorted(scored, reverse=True)[0][2]


def is_low_value_sentence(text: str) -> bool:
    lower = text.lower()
    low_value_patterns = [
        "a little bit about what this course is",
        "let me stop there",
        "see everyone next week",
        "see you next week",
        "i will see everyone",
        "what this course is",
        "thank you",
    ]
    return any(pattern in lower for pattern in low_value_patterns)


def sentence_for_concept(text: str, concept: str) -> str:
    concept_lower = concept.lower()
    for sentence in re.split(r"(?<=[.!?])\s+", text):
        clean = clean_teaching_text(sentence)
        if concept_lower in clean.lower() and len(meaningful_words(clean)) >= 3:
            return clean
    return ""


def first_chunk_with_concept(chunks: list[TimelineChunk], concept: str) -> TimelineChunk:
    concept_lower = concept.lower()
    for chunk in chunks:
        searchable = " ".join([chunk.transcript, " ".join(chunk.ocr), " ".join(chunk.concepts)]).lower()
        if concept_lower in searchable:
            return chunk
    return chunks[0]


def time_range(chunk: TimelineChunk) -> str:
    return f"{chunk.start}-{chunk.end}"


def ocr_text(chunk: TimelineChunk) -> str:
    return "; ".join(chunk.ocr) if chunk.ocr else "No OCR text available"


def has_ocr_evidence(chunk: TimelineChunk) -> bool:
    for item in chunk.ocr:
        if has_ocr_evidence_text(item):
            return True
    return False


def has_ocr_evidence_text(item: str) -> bool:
    text = item.strip().lower()
    return bool(
        text
        and not text.startswith("no ocr")
        and "no readable text" not in text
        and "ocr engine ran" not in text
        and "pasted transcript only" not in text
    )


def definition_for(concept: str, chunks: list[TimelineChunk] | None = None) -> str:
    known_definition = DEFINITIONS.get(concept.lower())
    if known_definition:
        return known_definition
    if chunks:
        source = first_chunk_with_concept(chunks, concept)
        sentence = sentence_for_concept(source.transcript, concept)
        if sentence:
            return simplify_sentence(sentence, limit=165).rstrip(".")
    return "an idea the lecture returns to; review the linked timestamp and rewrite it in your own words"


def simplify_sentence(text: str, limit: int = 180) -> str:
    sentence = text.strip()
    if len(sentence) <= limit:
        return sentence
    return sentence[: max(0, limit - 3)].rstrip() + "..."


def title_case(text: str) -> str:
    return " ".join(word.capitalize() for word in text.split())


def timestamp_seconds(value: str) -> int:
    parts = value.split(":")
    if len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        hours, minutes, seconds = parts[-3:]
    return int(hours) * 3600 + int(minutes) * 60 + int(float(seconds.replace(",", ".")))


def to_vtt_timestamp(value: str) -> str:
    parts = value.split(":")
    if len(parts) == 2:
        hours = 0
        minutes, seconds = parts
    else:
        hours, minutes, seconds = parts[-3:]
    seconds_value = int(float(seconds.replace(",", ".")))
    return f"{int(hours):02}:{int(minutes):02}:{seconds_value:02}.000"


def normalize_caption_text(text: str) -> str:
    lines = [line.strip() for line in text.replace("\r", "\n").split("\n")]
    return "\n".join(line for line in lines if line)
