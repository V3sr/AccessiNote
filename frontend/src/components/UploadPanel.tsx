"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  PlusCircle,
  ScanText,
  Upload,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useState } from "react";

import type { CapabilityResponse } from "@/lib/types";

interface UploadPanelProps {
  onLoadSample: () => Promise<void>;
  onCreateLecture: (title: string, transcript: string) => Promise<void>;
  onUploadVideo: (title: string, videoFile: File, transcript: string) => Promise<void>;
  onUploadImage: (title: string, imageFile: File, notes: string) => Promise<void>;
  capabilities: CapabilityResponse | null;
  isBusy: boolean;
}

type SourceTab = "sample" | "transcript" | "image" | "video";

const sourceTabs: Array<{
  id: SourceTab;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "sample", label: "Sample", icon: Layers },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "image", label: "Image", icon: ImageIcon },
  { id: "video", label: "Video", icon: Video },
];

export function UploadPanel({
  onLoadSample,
  onCreateLecture,
  onUploadVideo,
  onUploadImage,
  capabilities,
  isBusy,
}: UploadPanelProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("sample");
  const [title, setTitle] = useState("My Local Transcript");
  const [transcript, setTranscript] = useState("");
  const [imageTitle, setImageTitle] = useState("Uploaded Slide Image");
  const [imageNotes, setImageNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("Uploaded Video Lecture");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const ocrReady = Boolean(capabilities?.ocr_engines.length);
  const primaryOcr = capabilities?.ocr_engines.map(formatEngineName).join(", ") || "Not ready";

  async function submitTranscript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateLecture(title, transcript);
  }

  async function submitVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile) {
      return;
    }
    await onUploadVideo(videoTitle, videoFile, videoTranscript);
  }

  async function submitImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) {
      return;
    }
    await onUploadImage(imageTitle, imageFile, imageNotes);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="border-b border-zinc-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Source Desk</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-600">Choose the local material to turn into evidence.</p>
          </div>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">
            OCR {ocrReady ? "ready" : "offline"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {sourceTabs.map(({ id, label, icon: Icon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-md border px-2 py-2 text-sm font-semibold transition active:translate-y-px ${
                  selected
                    ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "sample" && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-950">Synthetic lecture</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Load a deterministic linear algebra lecture with transcript, OCR text, concepts, and visual
              descriptions.
            </p>
            <button
              type="button"
              onClick={onLoadSample}
              disabled={isBusy}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-emerald-950"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Load Sample Lecture
            </button>
          </div>
        )}

        {activeTab === "transcript" && (
          <form onSubmit={submitTranscript}>
            <FieldLabel htmlFor="lecture-title">Lecture title</FieldLabel>
            <input
              id="lecture-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
            <FieldLabel htmlFor="transcript">Transcript</FieldLabel>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={10}
              placeholder="Paste permitted lecture transcript text here..."
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={isBusy || transcript.trim().length === 0}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-emerald-950"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Create Timeline
            </button>
          </form>
        )}

        {activeTab === "image" && (
          <form onSubmit={submitImage}>
            <CapabilityRow label="OCR scan" value={capabilities ? primaryOcr : "Checking"} ready={ocrReady} />

            <FieldLabel htmlFor="image-title">Image title</FieldLabel>
            <input
              id="image-title"
              value={imageTitle}
              onChange={(event) => setImageTitle(event.target.value)}
              className={inputClass}
            />
            <FieldLabel htmlFor="image-file">Image file</FieldLabel>
            <input
              id="image-file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
              className={fileInputClass}
            />
            <FieldLabel htmlFor="image-notes">Optional notes</FieldLabel>
            <textarea
              id="image-notes"
              value={imageNotes}
              onChange={(event) => setImageNotes(event.target.value)}
              rows={4}
              placeholder="Optional: add slide context, course topic, or what to verify."
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={isBusy || !imageFile || !ocrReady}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-emerald-950"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
              Scan Image
            </button>
          </form>
        )}

        {activeTab === "video" && (
          <form onSubmit={submitVideo}>
            <div className="grid gap-2">
              <CapabilityRow
                label="Frame extraction"
                value={capabilities ? (capabilities.ffmpeg_available ? "Ready" : "Unavailable") : "Checking"}
                ready={Boolean(capabilities?.ffmpeg_available)}
              />
              <CapabilityRow label="OCR scan" value={capabilities ? primaryOcr : "Checking"} ready={ocrReady} />
            </div>

            {capabilities?.notes.length ? (
              <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-800">
                {capabilities.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : null}

            <FieldLabel htmlFor="video-title">Video title</FieldLabel>
            <input
              id="video-title"
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
              className={inputClass}
            />
            <FieldLabel htmlFor="video-file">Video file</FieldLabel>
            <input
              id="video-file"
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,.mp4,.mov,.mkv,.webm,.avi,.m4v"
              onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
              className={fileInputClass}
            />
            <FieldLabel htmlFor="video-transcript">Optional transcript or notes</FieldLabel>
            <textarea
              id="video-transcript"
              value={videoTranscript}
              onChange={(event) => setVideoTranscript(event.target.value)}
              rows={5}
              placeholder="Optional: paste captions or notes to pair with scanned video frames."
              className={textareaClass}
            />
            <button
              type="submit"
              disabled={isBusy || !videoFile || !capabilities?.ffmpeg_available}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-emerald-950"
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload and Scan
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function CapabilityRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  const Icon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex min-h-10 min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5">
      <span className="flex min-w-0 items-center gap-2 font-semibold text-zinc-800">
        {label === "OCR scan" ? (
          <ScanText className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        ) : (
          <Video className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        )}
        {label}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold ${
          ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function formatEngineName(engine: string): string {
  if (engine === "rapidocr") {
    return "RapidOCR";
  }
  if (engine === "tesseract") {
    return "Tesseract";
  }
  return engine;
}

const inputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const textareaClass =
  "mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const fileInputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white";
