"use client";

import { Activity, FileCheck2, Loader2, ScanText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
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
  uploadImageLecture,
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

  const ocrChunkCount = lecture?.chunks.filter((chunk) => hasReadableOcrEvidence(chunk.ocr)).length ?? 0;
  const averageSourceConfidence = lecture
    ? lecture.chunks.reduce((total, chunk) => total + chunk.source_confidence, 0) / Math.max(1, lecture.chunks.length)
    : 0;

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
        `Video timeline created with ${uploaded.frame_count} extracted frame(s). OCR text found in ${uploaded.ocr_frame_count} frame(s). Engine: ${uploaded.ocr_engine}.${warningText}`,
      );
    });
  }

  async function handleUploadImage(title: string, imageFile: File, notes: string) {
    await runAction(async () => {
      const uploaded = await uploadImageLecture(title, imageFile, notes);
      const nextLecture = await getLecture(uploaded.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
      const warningText = uploaded.warnings.length > 0 ? ` ${uploaded.warnings.join(" ")}` : "";
      setNotice(
        `Image timeline created with ${uploaded.ocr_text_count} OCR text line(s). Engine: ${uploaded.ocr_engine}.${warningText}`,
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
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f4f6f8] text-zinc-950">
      <Header apiStatus={apiStatus} />
      <SafetyBanner />

      <div className="mx-auto grid min-w-0 max-w-[1500px] gap-6 px-5 py-6 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:px-8">
        <aside className="min-w-0 space-y-5 lg:sticky lg:top-6">
          <UploadPanel
            onLoadSample={handleLoadSample}
            onCreateLecture={handleCreateLecture}
            onUploadVideo={handleUploadVideo}
            onUploadImage={handleUploadImage}
            capabilities={capabilities}
            isBusy={isBusy}
          />

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
            <p className="mb-3 text-sm leading-5 text-zinc-700">
              Current mode: <span className="font-semibold text-zinc-950">{selectedMode.replaceAll("_", " ")}</span>
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!lecture || isBusy}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate Output
            </button>

            {error && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                {notice}
              </div>
            )}
          </section>

          <ModeSelector selectedMode={selectedMode} onSelectMode={setSelectedMode} disabled={!lecture || isBusy} />
        </aside>

        <div className="min-w-0 space-y-5">
          <section className="grid gap-3 xl:grid-cols-3">
            <WorkbenchStat
              icon={<Activity className="h-4 w-4" aria-hidden="true" />}
              label="Source"
              value={lecture ? lecture.source.type : "Not loaded"}
              detail={lecture ? lecture.title : "Choose a source from the desk."}
            />
            <WorkbenchStat
              icon={<ScanText className="h-4 w-4" aria-hidden="true" />}
              label="Evidence"
              value={lecture ? `${lecture.chunks.length} chunks` : "Waiting"}
              detail={lecture ? `${ocrChunkCount} chunks with OCR text.` : "No timeline yet."}
            />
            <WorkbenchStat
              icon={<FileCheck2 className="h-4 w-4" aria-hidden="true" />}
              label="Output"
              value={output ? output.title : selectedMode.replaceAll("_", " ")}
              detail={
                output
                  ? "Markdown is ready to copy or download."
                  : lecture
                    ? `${percent(averageSourceConfidence)} average source confidence.`
                    : "Generate after loading evidence."
              }
            />
          </section>

          <div className="grid min-w-0 gap-5">
            <TimelineViewer lecture={lecture} />
            <OutputViewer output={output} />
          </div>
        </div>
      </div>
    </main>
  );
}

function WorkbenchStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
    </div>
  );
}

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function hasReadableOcrEvidence(items: string[]): boolean {
  return items.some(
    (item) =>
      item.trim().length > 0 &&
      !item.toLowerCase().startsWith("no ocr") &&
      !item.toLowerCase().includes("no readable text"),
  );
}
