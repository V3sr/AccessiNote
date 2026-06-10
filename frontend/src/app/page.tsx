"use client";

import { Activity, Database, FileCheck2, Loader2, Sparkles } from "lucide-react";
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
  getCapabilities,
  getHealth,
  getLecture,
  loadSampleLecture,
  uploadVideoLecture,
} from "@/lib/api";
import type { CapabilityResponse, GenerateResponse, LectureTimeline, OutputMode } from "@/lib/types";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [lecture, setLecture] = useState<LectureTimeline | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<OutputMode>("adhd_study_pack");
  const [output, setOutput] = useState<GenerateResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));
    getCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
  }, []);

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    setNotice(null);
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

  async function handleUploadVideo(title: string, videoFile: File, transcript: string) {
    await runAction(async () => {
      const uploaded = await uploadVideoLecture(title, videoFile, transcript);
      const nextLecture = await getLecture(uploaded.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
      const warningText = uploaded.warnings.length > 0 ? ` ${uploaded.warnings.join(" ")}` : "";
      setNotice(
        `Video timeline created with ${uploaded.frame_count} extracted frame(s). OCR engine: ${uploaded.ocr_engine}.${warningText}`,
      );
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
    <main className="min-h-screen bg-[#e8edf0] text-zinc-950">
      <Header apiStatus={apiStatus} />
      <SafetyBanner />

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:px-8">
        <aside className="space-y-5 lg:sticky lg:top-6">
          <UploadPanel
            onLoadSample={handleLoadSample}
            onCreateLecture={handleCreateLecture}
            onUploadVideo={handleUploadVideo}
            capabilities={capabilities}
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
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Output
          </button>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
              {notice}
            </div>
          )}
        </aside>

        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Source
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-950">
                {lecture ? lecture.source.type : "No lecture loaded"}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {lecture ? lecture.title : "No source selected."}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
                <Database className="h-4 w-4" aria-hidden="true" />
                Timeline
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-950">
                {lecture ? `${lecture.chunks.length} chunks` : "Waiting"}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {lecture ? `${lecture.source.type} timeline ready.` : "Awaiting source."}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Output
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-950">
                {output ? output.title : selectedMode.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-600">
                {output ? "Markdown generated." : "Not generated yet."}
              </p>
            </div>
          </section>
          <TimelineViewer lecture={lecture} />
          <OutputViewer output={output} />
        </div>
      </div>
    </main>
  );
}
