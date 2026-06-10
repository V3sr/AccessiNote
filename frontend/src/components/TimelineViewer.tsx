import { Clock, Eye, FileText, Gauge, ImageIcon, ScanText } from "lucide-react";
import type { ReactNode } from "react";

import { assetUrl } from "@/lib/api";
import type { LectureTimeline, TimelineChunk } from "@/lib/types";

interface TimelineViewerProps {
  lecture: LectureTimeline | null;
}

export function TimelineViewer({ lecture }: TimelineViewerProps) {
  if (!lecture) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-700">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-zinc-500" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-zinc-950">No timeline loaded</h2>
            <p className="mt-1 max-w-2xl">
              Load a sample lecture, paste a transcript, or upload a permitted video to inspect timestamped
              transcript, OCR, and visual evidence here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const ocrChunks = lecture.chunks.filter((chunk) => hasReadableOcrEvidence(chunk.ocr)).length;
  const averageSourceConfidence =
    lecture.chunks.reduce((total, chunk) => total + chunk.source_confidence, 0) / Math.max(1, lecture.chunks.length);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Timeline</p>
          <h2 className="text-xl font-semibold tracking-normal text-zinc-950">{lecture.title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{lecture.source.attribution || lecture.source.type}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <SummaryPill icon={<Clock className="h-3.5 w-3.5" />} label={`${lecture.chunks.length} chunks`} />
          <SummaryPill icon={<ScanText className="h-3.5 w-3.5" />} label={`${ocrChunks} with OCR`} />
          <SummaryPill
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={`${percent(averageSourceConfidence)} avg source`}
          />
        </div>
      </div>

      <div className="grid gap-3">
        {lecture.chunks.map((chunk) => (
          <TimelineChunkCard key={chunk.chunk_id} chunk={chunk} />
        ))}
      </div>
    </section>
  );
}

function TimelineChunkCard({ chunk }: { chunk: TimelineChunk }) {
  const hasFrame = Boolean(chunk.keyframe_path);
  const ocrDetected = chunk.ocr_confidence > 0 || hasReadableOcrEvidence(chunk.ocr);

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
      <div className={`grid gap-4 ${hasFrame ? "md:grid-cols-[220px_minmax(0,1fr)]" : ""}`}>
        {hasFrame && (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(chunk.keyframe_path)}
                alt={`Video keyframe for ${chunk.start}-${chunk.end}`}
                loading="lazy"
                className="aspect-video w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1 font-semibold text-zinc-700">
                <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Keyframe
              </span>
              <span
                className={`rounded-full px-2 py-1 font-semibold ${
                  ocrDetected ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
                }`}
              >
                OCR {chunk.ocr_confidence > 0 ? percent(chunk.ocr_confidence) : ocrDetected ? "text" : "none"}
              </span>
            </div>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {chunk.start}-{chunk.end}
            </span>
            <span className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {chunk.chunk_id}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-100">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              {percent(chunk.source_confidence)} source
            </span>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-800">{chunk.transcript}</p>

          {chunk.concepts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chunk.concepts.map((concept) => (
                <span
                  key={concept}
                  className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 ring-1 ring-sky-100"
                >
                  {concept}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidencePanel
          icon={<ScanText className="h-4 w-4 text-violet-700" aria-hidden="true" />}
          title="OCR Text"
          tone={ocrDetected ? "strong" : "quiet"}
        >
          <ul className="space-y-1 text-sm leading-6">
            {chunk.ocr.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </EvidencePanel>

        <EvidencePanel
          icon={<Eye className="h-4 w-4 text-zinc-600" aria-hidden="true" />}
          title="Visual Review"
          tone="quiet"
        >
          <p className="text-sm leading-6">{chunk.visual_description}</p>
        </EvidencePanel>
      </div>
    </article>
  );
}

function SummaryPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-zinc-800 ring-1 ring-zinc-200">
      {icon}
      {label}
    </span>
  );
}

function EvidencePanel({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: "strong" | "quiet";
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-md px-3 py-3 ${
        tone === "strong"
          ? "border border-violet-200 bg-violet-50 text-violet-950"
          : "border border-zinc-200 bg-zinc-50 text-zinc-800"
      }`}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
        {icon}
        {title}
      </h3>
      <div className="mt-2">{children}</div>
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
