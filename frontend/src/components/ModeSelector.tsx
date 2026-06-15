"use client";

import { BookOpen, Brain, Captions, ClipboardCheck, FileJson, FileSearch, FileText, Glasses, Languages } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { OutputMode } from "@/lib/types";

interface ModeSelectorProps {
  selectedMode: OutputMode;
  onSelectMode: (mode: OutputMode) => void;
  disabled?: boolean;
}

const modes: Array<{
  mode: OutputMode;
  label: string;
  description: string;
  icon: typeof BookOpen;
}> = [
  {
    mode: "structured_notes",
    label: "Visual Descriptions",
    description: "Notes with visual context, source anchors, and key details.",
    icon: BookOpen,
  },
  {
    mode: "adhd_study_pack",
    label: "ADHD/Focus Pack",
    description: "Short path, must-know ideas, quick checks, and recovery steps.",
    icon: Brain,
  },
  {
    mode: "screen_reader_notes",
    label: "Screen-reader Notes",
    description: "Linear notes with visual descriptions and timestamp anchors.",
    icon: Glasses,
  },
  {
    mode: "exam_prep_pack",
    label: "Exam Review Pack",
    description: "Flashcards, practice questions, and likely mistakes.",
    icon: FileSearch,
  },
  {
    mode: "plain_language",
    label: "Plain-language",
    description: "Simple explanation, analogy, and core terms.",
    icon: Languages,
  },
  {
    mode: "notetaker_quality_report",
    label: "Notetaker Review",
    description: "Checks for missing, unclear, or hard-to-use notes.",
    icon: ClipboardCheck,
  },
  {
    mode: "captions_vtt",
    label: "Caption Export",
    description: "Timed captions for review and download.",
    icon: Captions,
  },
  {
    mode: "timeline_json",
    label: "Source Timeline",
    description: "Downloadable timestamp trail for review.",
    icon: FileJson,
  },
  {
    mode: "transcript_txt",
    label: "Transcript Export",
    description: "Plain text transcript with timestamps.",
    icon: FileText,
  },
];

export function ModeSelector({ selectedMode, onSelectMode, disabled }: ModeSelectorProps) {
  const selected = modes.find((mode) => mode.mode === selectedMode) ?? modes[0];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Choose accessibility goal</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-600">Pick the learner or review need for this draft.</p>
        </div>
        <p className="text-xs font-semibold text-emerald-800">{selected.description}</p>
      </div>
      <div className="flex flex-wrap justify-start gap-2 p-3" role="group" aria-label="Accessibility goals">
        {modes.map(({ mode, label, icon: Icon }) => {
          const isSelected = selectedMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelectMode(mode)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed ${
                isSelected
                  ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                  : "border-zinc-200 bg-white text-[#27272a] hover:border-zinc-300 hover:bg-zinc-50 disabled:bg-zinc-50 disabled:text-[#52525b]"
              }`}
            >
              <Icon className="h-4 w-4 text-current" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
