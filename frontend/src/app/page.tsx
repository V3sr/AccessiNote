"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { ModeSelector } from "@/components/ModeSelector";
import { OutputViewer } from "@/components/OutputViewer";
import { SafetyBanner } from "@/components/SafetyBanner";
import { TimelineViewer } from "@/components/TimelineViewer";
import { UploadPanel } from "@/components/UploadPanel";
import {
  createLectureFromTranscript,
  generateOutput,
  getHealth,
  getLecture,
  loadSampleLecture,
} from "@/lib/api";
import type { GenerateResponse, LectureTimeline, OutputMode } from "@/lib/types";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [lecture, setLecture] = useState<LectureTimeline | null>(null);
  const [selectedMode, setSelectedMode] = useState<OutputMode>("adhd_study_pack");
  const [output, setOutput] = useState<GenerateResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));
  }, []);

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    try {
      await action();
      setApiStatus("ok");
    } catch (caughtError) {
      setApiStatus("offline");
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLoadSample() {
    await runAction(async () => {
      const sample = await loadSampleLecture();
      setLecture(sample);
      setOutput(null);
    });
  }

  async function handleCreateLecture(title: string, transcript: string) {
    await runAction(async () => {
      const created = await createLectureFromTranscript(title, transcript);
      const nextLecture = await getLecture(created.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
    });
  }

  async function handleGenerate() {
    if (!lecture) {
      setError("Load or create a lecture before generating an output.");
      return;
    }

    await runAction(async () => {
      const generated = await generateOutput(lecture.lecture_id, selectedMode);
      setOutput(generated);
    });
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <Header apiStatus={apiStatus} />
      <SafetyBanner />

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <UploadPanel
            onLoadSample={handleLoadSample}
            onCreateLecture={handleCreateLecture}
            isBusy={isBusy}
          />
          <ModeSelector
            selectedMode={selectedMode}
            onSelectMode={setSelectedMode}
            disabled={!lecture || isBusy}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!lecture || isBusy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Output
          </button>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
              {error}
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <TimelineViewer lecture={lecture} />
          <OutputViewer output={output} />
        </div>
      </div>
    </main>
  );
}

