import { Clock, Eye, FileText, Gauge, ImageIcon, ScanText } from "lucide-react";
import type { ReactNode } from "react";

import { assetUrl } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LectureTimeline, TimelineChunk } from "@/lib/types";

interface TimelineViewerProps {
  lecture: LectureTimeline | null;
}

export function TimelineViewer({ lecture }: TimelineViewerProps) {
  if (!lecture) {
    return (
      <Card className="rounded-2xl border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-700 shadow-none">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 text-emerald-700" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-zinc-950">No evidence timeline yet</h2>
            <p className="mt-1 max-w-2xl">
              Load a sample lecture, paste a transcript, or upload permitted media to inspect transcript,
              OCR, visual review notes, and source confidence.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const ocrChunks = lecture.chunks.filter((chunk) => hasReadableOcrEvidence(chunk.ocr)).length;
  const weakChunks = lecture.processing_metadata.metrics.weak_chunk_count;
  const averageSourceConfidence =
    lecture.chunks.reduce((total, chunk) => total + chunk.source_confidence, 0) / Math.max(1, lecture.chunks.length);

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Evidence timeline</p>
          <h2 className="mt-1 text-xl font-semibold tracking-normal text-zinc-950">{lecture.title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{lecture.source.attribution || lecture.source.type}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <SummaryPill icon={<Clock className="h-3.5 w-3.5" />} label={`${lecture.chunks.length} chunks`} />
          <SummaryPill icon={<ScanText className="h-3.5 w-3.5" />} label={`${ocrChunks} with OCR`} />
          <SummaryPill icon={<FileText className="h-3.5 w-3.5" />} label={`${lecture.caption_segments.length} captions`} />
          <SummaryPill
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={`${percent(averageSourceConfidence)} avg source`}
          />
          {weakChunks > 0 && (
            <SummaryPill icon={<Eye className="h-3.5 w-3.5" />} label={`${weakChunks} weak`} />
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4">
        {lecture.chunks.map((chunk) => (
          <TimelineChunkCard key={chunk.chunk_id} chunk={chunk} />
        ))}
      </div>
    </Card>
  );
}

function TimelineChunkCard({ chunk }: { chunk: TimelineChunk }) {
  const hasFrame = Boolean(chunk.keyframe_path);
  const ocrDetected = chunk.ocr_confidence > 0 || hasReadableOcrEvidence(chunk.ocr);

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4">
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
              <Badge
                className={`rounded-md px-2 py-1 font-semibold ${
                  ocrDetected ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
                }`}
              >
                OCR {chunk.ocr_confidence > 0 ? percent(chunk.ocr_confidence) : ocrDetected ? "text" : "none"}
              </Badge>
            </div>
          </div>
        )}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-800">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {chunk.start}-{chunk.end}
            </Badge>
            <Badge className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-white hover:bg-zinc-950">{chunk.chunk_id}</Badge>
            <Badge className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              {percent(chunk.source_confidence)} source
            </Badge>
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-800">{chunk.transcript}</p>

          {chunk.concepts.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chunk.concepts.map((concept) => (
                <span key={concept} className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800">
                  {concept}
                </span>
              ))}
            </div>
          )}

          {chunk.evidence_flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {chunk.evidence_flags.map((flag) => (
                <span key={flag} className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 ring-1 ring-sky-100">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <EvidencePanel
          icon={<ScanText className="h-4 w-4 text-emerald-700" aria-hidden="true" />}
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
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-zinc-50 px-2.5 py-1 text-zinc-800 ring-1 ring-zinc-200">
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
      className={`rounded-xl px-3 py-3 ${
        tone === "strong"
          ? "border border-emerald-200 bg-emerald-50 text-emerald-950"
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
