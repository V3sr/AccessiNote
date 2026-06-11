"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  ImageIcon,
  Loader2,
  Play,
  PlusCircle,
  ScanText,
  Upload,
  Video,
} from "lucide-react";
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

export function UploadPanel({
  onLoadSample,
  onCreateLecture,
  onUploadVideo,
  onUploadImage,
  capabilities,
  isBusy,
}: UploadPanelProps) {
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
    <section className="min-w-0 space-y-5">
      <div className="min-w-0 max-w-full rounded-lg bg-zinc-950 p-4 text-white shadow-soft">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Play className="h-5 w-5 text-emerald-300" aria-hidden="true" />
          Start
        </h2>
        <p className="mt-2 break-words text-sm leading-6 text-zinc-300">
          Load the built-in synthetic lecture or paste a transcript to create a local timeline.
        </p>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isBusy}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 active:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-950 disabled:text-emerald-200"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Load Sample Lecture
        </button>
      </div>

      <form
        onSubmit={submitTranscript}
        className="min-w-0 max-w-full rounded-lg border border-zinc-200 bg-white p-4 shadow-soft"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <PlusCircle className="h-5 w-5 text-sky-700" aria-hidden="true" />
          Paste Transcript
        </h2>
        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="lecture-title">
          Lecture title
        </label>
        <input
          id="lecture-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="transcript">
          Transcript
        </label>
        <textarea
          id="transcript"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          rows={9}
          placeholder="Paste permitted lecture transcript text here..."
          className="mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          disabled={isBusy || transcript.trim().length === 0}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 active:bg-sky-900 disabled:cursor-not-allowed disabled:bg-sky-50 disabled:text-sky-950"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Create Timeline
        </button>
      </form>

      <form
        onSubmit={submitImage}
        className="min-w-0 max-w-full rounded-lg border border-emerald-200 bg-white p-4 shadow-soft"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <ImageIcon className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          Upload Image/Slide
        </h2>

        <div className="mt-3 grid gap-2 text-xs leading-5">
          <CapabilityRow
            label="OCR scan"
            value={capabilities ? primaryOcr : "Checking"}
            ready={ocrReady}
          />
        </div>

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="image-title">
          Image title
        </label>
        <input
          id="image-title"
          value={imageTitle}
          onChange={(event) => setImageTitle(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="image-file">
          Image file
        </label>
        <input
          id="image-file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff,.png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="image-notes">
          Optional notes
        </label>
        <textarea
          id="image-notes"
          value={imageNotes}
          onChange={(event) => setImageNotes(event.target.value)}
          rows={4}
          placeholder="Optional: add slide context, course topic, or what to verify."
          className="mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        <button
          type="submit"
          disabled={isBusy || !imageFile || !ocrReady}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-950"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
          Scan Image
        </button>
      </form>

      <form
        onSubmit={submitVideo}
        className="min-w-0 max-w-full rounded-lg border border-violet-200 bg-white p-4 shadow-soft"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <Video className="h-5 w-5 text-violet-700" aria-hidden="true" />
          Upload Video
        </h2>

        <div className="mt-3 grid gap-2 text-xs leading-5">
          <CapabilityRow
            label="Frame extraction"
            value={capabilities ? (capabilities.ffmpeg_available ? "Ready" : "Unavailable") : "Checking"}
            ready={Boolean(capabilities?.ffmpeg_available)}
          />
          <CapabilityRow
            label="OCR scan"
            value={capabilities ? primaryOcr : "Checking"}
            ready={ocrReady}
          />
        </div>

        {capabilities?.notes.length ? (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-800">
            {capabilities.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </div>
        ) : null}

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="video-title">
          Video title
        </label>
        <input
          id="video-title"
          value={videoTitle}
          onChange={(event) => setVideoTitle(event.target.value)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="video-file">
          Video file
        </label>
        <input
          id="video-file"
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo,.mp4,.mov,.mkv,.webm,.avi,.m4v"
          onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
          className="mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
        />

        <label className="mt-4 block text-sm font-medium text-zinc-800" htmlFor="video-transcript">
          Optional transcript or notes
        </label>
        <textarea
          id="video-transcript"
          value={videoTranscript}
          onChange={(event) => setVideoTranscript(event.target.value)}
          rows={5}
          placeholder="Optional: paste captions or notes to pair with scanned video frames."
          className="mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
        />
        <button
          type="submit"
          disabled={isBusy || !videoFile || !capabilities?.ffmpeg_available}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800 active:bg-violet-900 disabled:cursor-not-allowed disabled:bg-violet-50 disabled:text-violet-950"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload and Scan
        </button>
      </form>
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
    <div className="flex min-h-11 min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 font-semibold text-zinc-800">
        {label === "OCR scan" ? (
          <ScanText className="h-4 w-4 text-violet-700" aria-hidden="true" />
        ) : (
          <Video className="h-4 w-4 text-zinc-600" aria-hidden="true" />
        )}
        {label}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
          ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
        }`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {value}
      </span>
    </div>
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
