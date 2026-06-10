"use client";

import {
  BookOpen,
  Brain,
  ClipboardCheck,
  FileSearch,
  Glasses,
  Languages,
} from "lucide-react";

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
    label: "Exam Prep Pack",
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
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="text-base font-semibold text-zinc-950">Output Mode</h2>
      <div className="mt-4 grid gap-2">
        {modes.map(({ mode, label, description, icon: Icon }) => {
          const selected = mode === selectedMode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onSelectMode(mode)}
              disabled={disabled}
              className={`flex min-h-20 w-full items-start gap-3 rounded-md border p-3 text-left transition ${
                selected
                  ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                  : "border-zinc-200 bg-white text-zinc-800 hover:border-sky-300 hover:bg-sky-50"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <Icon
                className={`mt-0.5 h-5 w-5 shrink-0 ${selected ? "text-emerald-700" : "text-zinc-500"}`}
                aria-hidden="true"
              />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-zinc-600">{description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

