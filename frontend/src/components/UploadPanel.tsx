"use client";

import {
  AlertTriangle,
  FileText,
  ImageIcon,
  Layers,
  Loader2,
  PlusCircle,
  ScanText,
  Upload,
  UploadCloud,
  Video,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProcessingJob } from "@/lib/types";

interface UploadPanelProps {
  onLoadSample: () => Promise<void>;
  onCreateLecture: (title: string, transcript: string) => Promise<void>;
  onUploadVideo: (title: string, videoFile: File, transcript: string, transcriptFile?: File | null) => Promise<void>;
  onUploadImage: (title: string, imageFile: File, notes: string) => Promise<void>;
  isBusy: boolean;
  processingJob?: ProcessingJob | null;
  onCancelProcessingJob?: (jobId: string) => void;
}

type SourceTab = "sample" | "transcript" | "image" | "video";

const sourceTabs: Array<{
  id: SourceTab;
  label: string;
  icon: typeof FileText;
}> = [
  { id: "sample", label: "Sample", icon: Layers },
  { id: "transcript", label: "Transcript", icon: FileText },
  { id: "image", label: "Slides", icon: ImageIcon },
  { id: "video", label: "Recording", icon: Video },
];

const supportedSources = [
  { label: "Recordings", detail: "MP4, MOV, WebM", icon: Video },
  { label: "Transcripts", detail: "TXT, SRT, VTT", icon: FileText },
  { label: "Slides and notes", detail: "PNG, JPG, WebP", icon: ImageIcon },
  { label: "Sample lecture", detail: "Try the workflow", icon: Layers },
];

export function UploadPanel({
  onLoadSample,
  onCreateLecture,
  onUploadVideo,
  onUploadImage,
  isBusy,
  processingJob,
  onCancelProcessingJob,
}: UploadPanelProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("sample");
  const [title, setTitle] = useState("My transcript");
  const [transcript, setTranscript] = useState("");
  const [imageTitle, setImageTitle] = useState("Uploaded Slide Image");
  const [imageNotes, setImageNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("Uploaded lecture recording");
  const [videoTranscript, setVideoTranscript] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTranscriptFile, setVideoTranscriptFile] = useState<File | null>(null);

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
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SourceTab)}>
        <div className="p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-soft ring-1 ring-zinc-200">
                <UploadCloud className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-normal text-zinc-950">Add lecture materials</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600">
                Choose a permitted source to create a reviewable study draft with timestamps.
              </p>
              <Badge className="mt-4 inline-flex min-h-9 gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                Draft — human review required
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
        </div>

        <div className="border-t border-zinc-200 p-4 sm:p-5">
          {processingJob && processingJob.status !== "complete" && (
            <ProcessingProgress job={processingJob} onCancel={onCancelProcessingJob} />
          )}

          <TabsContent value="sample" className="mt-0">
            <div>
              <h3 className="text-sm font-semibold text-zinc-950">Sample lecture</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                Try AccessiNote with a sample lecture that already includes timestamps, source chunks, and review notes.
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
          </TabsContent>

          <TabsContent value="transcript" className="mt-0">
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
                placeholder="Paste permitted lecture transcript text here."
                className={textareaClass}
              />
              <Button type="submit" disabled={isBusy || transcript.trim().length === 0} className={primaryButtonClass}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Create timeline
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="image" className="mt-0">
            <form onSubmit={submitImage}>
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
                placeholder="Optional: add slide context, course topic, or what a reviewer should check."
                className={textareaClass}
              />
              <Button type="submit" disabled={isBusy || !imageFile} className={primaryButtonClass}>
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
                Add slides or image
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <form onSubmit={submitVideo}>
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
                placeholder="Optional: paste captions or notes to improve the review draft."
                className={textareaClass}
              />
              <Button
                type="submit"
                disabled={isBusy || !videoFile}
                className={primaryButtonClass}
              >
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Add recording
              </Button>
            </form>
          </TabsContent>
        </div>
      </Tabs>
    </Card>
  );
}

function ProcessingProgress({ job, onCancel }: { job: ProcessingJob; onCancel?: (jobId: string) => void }) {
  const canCancel = job.status === "queued" || job.status === "running";
  const statusLabel =
    job.status === "failed"
      ? "Failed"
      : job.status === "canceled"
        ? "Canceled"
        : job.status === "queued"
          ? "Queued"
          : "Preparing draft";
  return (
    <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950" aria-live="polite">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-semibold">
          {job.status === "failed" || job.status === "canceled" ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {statusLabel}: {formatUserStage(job.stage)}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">{job.progress}%</span>
          {canCancel && onCancel ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancel(job.job_id)}
              className="min-h-8 rounded-md border-sky-300 bg-white px-2 py-1 text-xs font-semibold text-sky-950 hover:bg-sky-100"
            >
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sky-100">
        <div
          className="h-full rounded-full bg-sky-700 transition-[width]"
          style={{ width: `${Math.max(5, Math.min(100, job.progress))}%` }}
        />
      </div>
      {job.error && <p className="mt-2 text-xs leading-5 text-rose-900">{friendlyJobError(job.error)}</p>}
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

function formatUserStage(stage: string): string {
  const normalized = stage.toLowerCase();
  if (normalized.includes("queued")) {
    return "waiting to start";
  }
  if (normalized.includes("audio") || normalized.includes("transcrib")) {
    return "reading the recording";
  }
  if (normalized.includes("ocr") || normalized.includes("frame") || normalized.includes("visual")) {
    return "checking slides and visual content";
  }
  if (normalized.includes("align")) {
    return "matching notes to timestamps";
  }
  if (normalized.includes("ready")) {
    return "ready for review";
  }
  if (normalized.includes("failed")) {
    return "needs attention";
  }
  return stage || "preparing accessible notes";
}

function friendlyJobError(error: string): string {
  if (!error) {
    return "";
  }
  if (error.toLowerCase().includes("unsupported file type")) {
    return "This file type is not supported. Try a recording, transcript, caption file, slide, or image.";
  }
  if (error.toLowerCase().includes("too large")) {
    return "This file is too large for the current draft workflow. Try a shorter recording or smaller file.";
  }
  return "AccessiNote could not finish this draft. Try again with a shorter source or attach captions/transcript text.";
}

const primaryButtonClass =
  "mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-900";

const inputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const textareaClass =
  "mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100";

const fileInputClass =
  "mt-2 min-h-11 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white";
