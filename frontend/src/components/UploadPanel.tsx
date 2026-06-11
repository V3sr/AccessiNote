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
  UploadCloud,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CapabilityResponse } from "@/lib/types";

interface UploadPanelProps {
  onLoadSample: () => Promise<void>;
  onCreateLecture: (title: string, transcript: string) => Promise<void>;
  onUploadVideo: (title: string, videoFile: File, transcript: string, transcriptFile?: File | null) => Promise<void>;
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

const supportedSources = [
  { label: "MP4, MOV, WebM", detail: "Video files", icon: Video },
  { label: "TXT, captions", detail: "Transcripts", icon: FileText },
  { label: "PNG, JPG, WebP", detail: "Slides and notes", icon: ImageIcon },
  { label: "Sample lecture", detail: "Demo timeline", icon: Layers },
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
  const [videoTranscriptFile, setVideoTranscriptFile] = useState<File | null>(null);

  const ocrReady = Boolean(capabilities?.ocr_engines.length);
  const primaryOcr = capabilities?.ocr_engines.map(formatEngineName).join(", ") || "Not ready";
  const captionReady = Boolean(capabilities?.local_transcription_available);

  async function submitTranscript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateLecture(title, transcript);
  }

  async function submitVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile) {
      return;
    }
    await onUploadVideo(videoTitle, videoFile, videoTranscript, videoTranscriptFile);
  }

  async function submitImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!imageFile) {
      return;
    }
    await onUploadImage(imageTitle, imageFile, imageNotes);
  }

  return (
    <Card id="source-desk" className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
          <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-soft ring-1 ring-zinc-200">
              <UploadCloud className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-normal text-zinc-950">Upload lecture materials</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600">
              Select a local source below to build a timestamped evidence timeline.
            </p>
            <Badge className="mt-4 inline-flex min-h-9 gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50">
              <ScanText className="h-3.5 w-3.5" aria-hidden="true" />
              OCR {ocrReady ? "ready" : "offline"}
            </Badge>
          </div>

          <div className="grid gap-2">
            {supportedSources.map(({ label, detail, icon: Icon }) => (
              <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-zinc-950">{label}</span>
                  <span className="block truncate text-xs text-zinc-600">{detail}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SourceTab)}>
          <TabsList className="mt-4 grid h-auto grid-cols-2 gap-2 bg-transparent p-0 sm:grid-cols-4">
            {sourceTabs.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="min-h-11 gap-2 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm font-semibold text-[#27272a] shadow-none transition hover:bg-zinc-50 active:translate-y-px data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-950 data-[state=active]:shadow-none"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="border-t border-zinc-200 p-4 sm:p-5">
        {activeTab === "sample" && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-950">Synthetic lecture</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              Load a deterministic linear algebra lecture with transcript, OCR text, concepts, and visual
              descriptions.
            </p>
            <Button
              type="button"
              onClick={onLoadSample}
              disabled={isBusy}
              className={primaryButtonClass}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Load sample lecture
            </Button>
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
              rows={8}
              placeholder="Paste permitted lecture transcript text here..."
              className={textareaClass}
            />
            <Button type="submit" disabled={isBusy || transcript.trim().length === 0} className={primaryButtonClass}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
              Create timeline
            </Button>
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
            <SelectedFile file={imageFile} />
            <FieldLabel htmlFor="image-notes">Optional notes</FieldLabel>
            <textarea
              id="image-notes"
              value={imageNotes}
              onChange={(event) => setImageNotes(event.target.value)}
              rows={4}
              placeholder="Optional: add slide context, course topic, or what to verify."
              className={textareaClass}
            />
            <Button type="submit" disabled={isBusy || !imageFile} className={primaryButtonClass}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
              {ocrReady ? "Scan image" : "Upload image with review note"}
            </Button>
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
              <CapabilityRow
                label="Caption generation"
                value={capabilities ? (captionReady ? "Ready" : "Upload captions") : "Checking"}
                ready={captionReady}
              />
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
            <SelectedFile file={videoFile} />
            <FieldLabel htmlFor="video-transcript-file">Optional captions/transcript file</FieldLabel>
            <input
              id="video-transcript-file"
              type="file"
              accept="text/plain,.txt,.srt,.vtt"
              onChange={(event) => setVideoTranscriptFile(event.target.files?.[0] ?? null)}
              className={fileInputClass}
            />
            <SelectedFile file={videoTranscriptFile} />
            <FieldLabel htmlFor="video-transcript">Optional transcript or notes text</FieldLabel>
            <textarea
              id="video-transcript"
              value={videoTranscript}
              onChange={(event) => setVideoTranscript(event.target.value)}
              rows={5}
              placeholder="Optional: paste captions or notes to pair with scanned video frames."
              className={textareaClass}
            />
            <Button
              type="submit"
              disabled={isBusy || !videoFile}
              className={primaryButtonClass}
            >
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {capabilities?.ffmpeg_available ? "Upload and scan" : "Upload with fallback timeline"}
            </Button>
          </form>
        )}
      </div>
    </Card>
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
        {label === "OCR scan" || label === "Caption generation" ? (
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

function SelectedFile({ file }: { file: File | null }) {
  if (!file) {
    return null;
  }
  return (
    <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700">
      Selected: <span className="font-semibold text-zinc-950">{file.name}</span> ({formatBytes(file.size)})
    </p>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const primaryButtonClass =
  "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-900";

const inputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const textareaClass =
  "mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const fileInputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white";
