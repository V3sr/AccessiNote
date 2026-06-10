from __future__ import annotations

from collections import Counter

from .models import GenerateResponse, LectureTimeline, OutputMode, SourceReference, TimelineChunk


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
}

DEFINITIONS: dict[str, str] = {
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
    }
    content = builders[mode](timeline)
    return GenerateResponse(
        lecture_id=timeline.lecture_id,
        mode=mode,
        title=MODE_TITLES[mode],
        content_markdown=content,
        sources=source_references(timeline),
        warnings=[SAFETY_WARNING],
    )


def build_structured_notes(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    lines = [
        f"# Structured Notes: {timeline.title}",
        "",
        "## Overview",
        f"This lecture explains {concept_phrase(chunks)} using transcript evidence, visible text, and visual descriptions from the timeline.",
        "",
        "## Timeline Outline",
    ]
    for chunk in chunks:
        lines.extend(
            [
                f"- **{time_range(chunk)}** ({chunk.chunk_id}): {chunk.transcript}",
                f"  - Visual source: {chunk.visual_description}",
                f"  - OCR/source text: {ocr_text(chunk)}",
            ]
        )

    lines.extend(["", "## Key Definitions"])
    for concept in top_concepts(chunks, limit=8):
        lines.append(f"- **{title_case(concept)}**: {definition_for(concept)}.")

    lines.extend(["", "## Worked Examples"])
    example_chunks = [chunk for chunk in chunks if "example" in " ".join(chunk.concepts).lower()]
    for chunk in example_chunks or chunks[-2:-1]:
        lines.append(
            f"- **{time_range(chunk)}**: Follow the steps described in the transcript. "
            f"The visual evidence notes: {chunk.visual_description}"
        )

    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_adhd_study_pack(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    must_know = top_concepts(chunks, limit=6)
    lines = [
        f"# ADHD Study Pack: {timeline.title}",
        "",
        "## Start Here",
        f"- Read the **{time_range(chunks[0])}** chunk first for the entry point.",
        f"- Then jump to **{time_range(chunks[-1])}** for the summary.",
        "- Stop after 10 minutes and check one flashcard-style question.",
        "",
        "## Must Know",
    ]
    for concept in must_know:
        lines.append(f"- **{title_case(concept)}**: {definition_for(concept)}.")

    lines.extend(
        [
            "",
            "## 10-Minute Review Plan",
            "- Minutes 0-2: Skim the timeline headings and timestamps.",
            "- Minutes 2-5: Read the chunks with worked examples or diagrams.",
            "- Minutes 5-8: Say the key terms out loud in plain language.",
            "- Minutes 8-10: Answer two quick checks without looking.",
            "",
            "## Quick Checks",
        ]
    )
    for chunk in chunks[:4]:
        lines.append(f"- At **{time_range(chunk)}**, what is the main job of {chunk.concepts[0]}?")

    lines.extend(
        [
            "",
            "## If You Are Overwhelmed",
            "- Start with one timestamp, not the whole lecture.",
            "- Copy one definition into your notes.",
            "- Use the visual descriptions as anchors for what was on screen.",
            "- Mark unclear items for a teacher, peer, or accessibility reviewer.",
        ]
    )
    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_screen_reader_notes(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    lines = [
        f"# Screen Reader Notes: {timeline.title}",
        "",
        "## Lecture Overview",
        f"The lecture covers {concept_phrase(chunks)}. Notes are organized by timestamp and avoid layout-dependent tables.",
        "",
        "## Section-by-Section Notes",
    ]
    for chunk in chunks:
        lines.extend(
            [
                f"- **{time_range(chunk)}**. {chunk.transcript}",
                f"  Important concepts: {', '.join(chunk.concepts)}.",
            ]
        )

    lines.extend(["", "## Visual Content Descriptions"])
    for chunk in chunks:
        lines.append(f"- **{time_range(chunk)}**: {chunk.visual_description}")

    lines.extend(["", "## Equations and Symbols"])
    for chunk in chunks:
        lines.append(f"- **{time_range(chunk)}**: {ocr_text(chunk)}")

    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_exam_prep_pack(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    concepts = top_concepts(chunks, limit=8)
    lines = [
        f"# Exam Prep Pack: {timeline.title}",
        "",
        "## Likely Testable Concepts",
    ]
    for concept in concepts:
        lines.append(f"- **{title_case(concept)}** from the timestamped material: {definition_for(concept)}.")

    lines.extend(["", "## Flashcards"])
    for concept in concepts[:6]:
        source = first_chunk_with_concept(chunks, concept)
        lines.extend(
            [
                f"- **Q:** What does {title_case(concept)} mean in this lecture?",
                f"  **A:** {definition_for(concept)}. Source: **{time_range(source)}**.",
            ]
        )

    lines.extend(["", "## Practice Questions"])
    for chunk in chunks:
        lines.append(
            f"- Using the evidence at **{time_range(chunk)}**, explain how {chunk.concepts[0]} connects to the lecture's main idea."
        )

    lines.extend(
        [
            "",
            "## Common Mistakes",
            "- Treating a matrix as only a grid of numbers instead of a transformation.",
            "- Ignoring where the basis vectors move.",
            "- Skipping visual evidence such as arrows, coordinate grids, or worked steps.",
            "- Memorizing terms without linking them to timestamps and examples.",
        ]
    )
    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_plain_language(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    lines = [
        f"# Plain-Language Explanation: {timeline.title}",
        "",
        "## Big Idea",
        "A lecture timeline can be read like a map. Each timestamp gives one part of the idea, and the transcript, OCR text, and visual description help confirm what happened there.",
        "",
        "## Step-by-Step Explanation",
    ]
    for chunk in chunks:
        lines.append(
            f"- **{time_range(chunk)}**: In simple terms, this part says: {simplify_sentence(chunk.transcript)}"
        )

    lines.extend(
        [
            "",
            "## Analogy",
            "Think of a matrix like a machine that moves arrows on a grid. The input vector goes in, the matrix changes it, and the output vector shows where it landed.",
            "",
            "## Terms in Simple Language",
        ]
    )
    for concept in top_concepts(chunks, limit=8):
        lines.append(f"- **{title_case(concept)}**: {definition_for(concept)}.")

    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def build_notetaker_quality_report(timeline: LectureTimeline) -> str:
    chunks = timeline.chunks
    completeness = min(100, 55 + len(chunks) * 7)
    structure = 88 if all(chunk.start and chunk.end for chunk in chunks) else 60
    accessibility = 90 if all(chunk.visual_description and has_ocr_evidence(chunk) for chunk in chunks) else 62
    clarity = int(sum(chunk.source_confidence for chunk in chunks) / max(1, len(chunks)) * 100)

    lines = [
        f"# Notetaker Quality Report: {timeline.title}",
        "",
        "## Scores",
        f"- Completeness: **{completeness}/100**",
        f"- Structure: **{structure}/100**",
        f"- Accessibility: **{accessibility}/100**",
        f"- Clarity: **{clarity}/100**",
        "",
        "## Strengths",
        "- The notes are timestamped, which supports review and source checking.",
        "- OCR text is separated from transcript text, making visual-source evidence easier to audit.",
        "- Visual descriptions are present for screen-reader and low-vision review workflows.",
        "",
        "## Missing or Weak Sections",
        "- Confirm whether equations, diagrams, and examples are complete against the original permitted lecture material.",
        "- Add speaker names if multiple speakers appear in the recording.",
        "- Flag unclear concepts that need human review or instructor confirmation.",
        "",
        "## Accessibility Improvements",
        "- Keep each timestamped section short and scannable.",
        "- Spell out symbols before relying on notation alone.",
        "- Add alt text or visual descriptions for every board drawing, slide, and diagram.",
        "",
        "## Upload Checklist",
        "- Confirm you have permission to use the lecture material.",
        "- Remove private student data, exams, accommodation records, and unrelated personal information.",
        "- Review generated notes before relying on them for study or accessibility support.",
    ]
    lines.extend(source_coverage_section(timeline))
    lines.extend(safety_section())
    return "\n".join(lines)


def source_references(timeline: LectureTimeline) -> list[SourceReference]:
    return [
        SourceReference(
            chunk_id=chunk.chunk_id,
            start=chunk.start,
            end=chunk.end,
            reason=f"Uses transcript, OCR, and visual description for {', '.join(chunk.concepts[:3])}.",
        )
        for chunk in timeline.chunks
    ]


def source_coverage_section(timeline: LectureTimeline) -> list[str]:
    lines = [
        "",
        "## Source Coverage",
        f"- Lecture source type: **{timeline.source.type}**.",
        f"- Generated from **{len(timeline.chunks)} of {len(timeline.chunks)}** available timeline chunks.",
    ]
    for chunk in timeline.chunks:
        lines.append(
            f"- **{time_range(chunk)}** ({chunk.chunk_id}): transcript plus OCR text `{ocr_text(chunk)}`; visual evidence: {chunk.visual_description}"
        )
    return lines


def safety_section() -> list[str]:
    return ["", "## Safety Note", f"- {SAFETY_WARNING}"]


def top_concepts(chunks: list[TimelineChunk], limit: int = 8) -> list[str]:
    counts: Counter[str] = Counter()
    for chunk in chunks:
        counts.update(chunk.concepts)
    return [concept for concept, _ in counts.most_common(limit)]


def concept_phrase(chunks: list[TimelineChunk]) -> str:
    concepts = top_concepts(chunks, limit=5)
    if not concepts:
        return "the main lecture ideas"
    if len(concepts) == 1:
        return concepts[0]
    return ", ".join(concepts[:-1]) + f", and {concepts[-1]}"


def first_chunk_with_concept(chunks: list[TimelineChunk], concept: str) -> TimelineChunk:
    for chunk in chunks:
        if concept in chunk.concepts:
            return chunk
    return chunks[0]


def time_range(chunk: TimelineChunk) -> str:
    return f"{chunk.start}-{chunk.end}"


def ocr_text(chunk: TimelineChunk) -> str:
    return "; ".join(chunk.ocr) if chunk.ocr else "No OCR text available"


def has_ocr_evidence(chunk: TimelineChunk) -> bool:
    for item in chunk.ocr:
        text = item.strip().lower()
        if text and not text.startswith("no ocr") and "no readable text" not in text:
            return True
    return False


def definition_for(concept: str) -> str:
    return DEFINITIONS.get(concept.lower(), f"a key idea discussed in the source around this timestamp")


def simplify_sentence(text: str) -> str:
    sentence = text.strip()
    if len(sentence) <= 180:
        return sentence
    return sentence[:177].rstrip() + "..."


def title_case(text: str) -> str:
    return " ".join(word.capitalize() for word in text.split())
