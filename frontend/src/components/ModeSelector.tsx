"use client";

import { BookOpen, Brain, ClipboardCheck, FileSearch, Glasses, Languages } from "lucide-react";

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
    label: "Structured Notes",
    description: "Overview, definitions, examples, and coverage.",
    icon: BookOpen,
  },
  {
    mode: "adhd_study_pack",
    label: "ADHD Study Pack",
    description: "Short bullets, review plan, and quick checks.",
    icon: Brain,
  },
  {
    mode: "screen_reader_notes",
    label: "Screen Reader Notes",
    description: "Linear notes with visual and equation descriptions.",
    icon: Glasses,
  },
  {
    mode: "exam_prep_pack",
    label: "Exam Prep",
    description: "Flashcards, practice questions, and mistakes.",
    icon: FileSearch,
  },
  {
    mode: "plain_language",
    label: "Plain Language",
    description: "Simple explanation, analogy, and core terms.",
    icon: Languages,
  },
  {
    mode: "notetaker_quality_report",
    label: "Quality Report",
    description: "Heuristic scores and accessibility improvements.",
    icon: ClipboardCheck,
  },
];

export function ModeSelector({ selectedMode, onSelectMode, disabled }: ModeSelectorProps) {
  const selected = modes.find((mode) => mode.mode === selectedMode) ?? modes[0];

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Output formats</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-600">Pick the accessible format to generate next.</p>
        </div>
        <p className="text-xs font-semibold text-emerald-800">{selected.description}</p>
      </div>
      <div className="flex flex-wrap gap-2 p-3">
        {modes.map(({ mode, label, icon: Icon }) => {
          const isSelected = mode === selectedMode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onSelectMode(mode)}
              disabled={disabled}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition active:translate-y-px ${
                isSelected
                  ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              } disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500`}
            >
              <Icon className={`h-4 w-4 ${isSelected ? "text-emerald-700" : "text-zinc-500"}`} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
