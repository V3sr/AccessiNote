import type { OutputMode } from "@/lib/types";

// One name per format. The six note formats match the headings the backend writes into each output.
export const MODE_OPTIONS: Array<{ mode: OutputMode; label: string; description: string }> = [
  {
    mode: "structured_notes",
    label: "Structured notes",
    description: "Read the main ideas, key terms and timestamps as one outline.",
  },
  {
    mode: "adhd_study_pack",
    label: "ADHD study pack",
    description: "Start with 3 minutes, then must-know terms and quick checks.",
  },
  {
    mode: "screen_reader_notes",
    label: "Screen reader notes",
    description: "Listen in one reading order, with slide text and visual notes.",
  },
  {
    mode: "exam_prep_pack",
    label: "Exam prep pack",
    description: "Practice with flashcards, prompts and common mistakes.",
  },
  {
    mode: "plain_language",
    label: "Plain-language explanation",
    description: "Read the lecture in simpler words, in up to six short stops.",
  },
  {
    mode: "notetaker_quality_report",
    label: "Notetaker quality report",
    description: "See what to check before you share notes.",
  },
  {
    mode: "captions_vtt",
    label: "Captions (WebVTT)",
    description: "Load timed captions into a video player.",
  },
  {
    mode: "timeline_json",
    label: "Full record (JSON)",
    description: "Keep everything AccessiNote found, with timestamps.",
  },
  {
    mode: "transcript_txt",
    label: "Plain transcript",
    description: "Get the transcript as plain text with timestamps.",
  },
];

export function modeLabel(mode: OutputMode): string {
  return MODE_OPTIONS.find((option) => option.mode === mode)?.label ?? "Notes";
}
