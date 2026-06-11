"use client";

import { BookOpen, Brain, ClipboardCheck, FileSearch, Glasses, Languages } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Output formats</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-600">Pick the accessible format to generate next.</p>
        </div>
        <p className="text-xs font-semibold text-emerald-800">{selected.description}</p>
      </div>
      <Tabs value={selectedMode} onValueChange={(value) => onSelectMode(value as OutputMode)}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-3">
          {modes.map(({ mode, label, icon: Icon }) => (
            <TabsTrigger
              key={mode}
              value={mode}
              disabled={disabled}
              className="min-h-11 gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-[#27272a] shadow-none transition hover:border-zinc-300 hover:bg-zinc-50 active:translate-y-px data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-950 data-[state=active]:shadow-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-[#52525b]"
            >
              <Icon className="h-4 w-4 text-current" aria-hidden="true" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </Card>
  );
}
