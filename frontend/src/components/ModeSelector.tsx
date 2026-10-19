"use client";

import { BookOpen, Brain, Captions, ClipboardCheck, FileJson, FileSearch, FileText, Glasses, Languages } from "lucide-react";

import { Card } from "@/components/ui/card";
import { MODE_OPTIONS } from "@/lib/modes";
import type { OutputMode } from "@/lib/types";

interface ModeSelectorProps {
  selectedMode: OutputMode;
  onSelectMode: (mode: OutputMode) => void;
  disabled?: boolean;
}

const modeIcons: Record<OutputMode, typeof BookOpen> = {
  structured_notes: BookOpen,
  adhd_study_pack: Brain,
  screen_reader_notes: Glasses,
  exam_prep_pack: FileSearch,
  plain_language: Languages,
  notetaker_quality_report: ClipboardCheck,
  captions_vtt: Captions,
  timeline_json: FileJson,
  transcript_txt: FileText,
};

export function ModeSelector({ selectedMode, onSelectMode, disabled }: ModeSelectorProps) {
  const selected = MODE_OPTIONS.find((option) => option.mode === selectedMode) ?? MODE_OPTIONS[0];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-2 border-b border-zinc-200 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Pick a format</h2>
          <p className="mt-1 text-sm leading-5 text-zinc-600">Choose the one that fits how you study.</p>
        </div>
        <p className="text-xs font-semibold text-emerald-800">{selected.description}</p>
      </div>
      <div className="flex flex-wrap justify-start gap-2 p-3" role="group" aria-label="Formats">
        {MODE_OPTIONS.map(({ mode, label }) => {
          const Icon = modeIcons[mode];
          const isSelected = selectedMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelectMode(mode)}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold shadow-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed ${
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
