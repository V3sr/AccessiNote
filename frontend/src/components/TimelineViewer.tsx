import { Clock, Eye, FileText } from "lucide-react";

import type { LectureTimeline } from "@/lib/types";

interface TimelineViewerProps {
  lecture: LectureTimeline | null;
}

export function TimelineViewer({ lecture }: TimelineViewerProps) {
  if (!lecture) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-600">
        Load a sample lecture or create a transcript timeline to view timestamped chunks here.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-zinc-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Timeline
          </p>
          <h2 className="text-xl font-semibold tracking-normal text-zinc-950">{lecture.title}</h2>
        </div>
        <p className="text-sm text-zinc-600">
          {lecture.chunks.length} chunks from {lecture.source.type}
        </p>
      </div>

      <div className="grid gap-3">
        {lecture.chunks.map((chunk) => (
          <article key={chunk.chunk_id} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {chunk.start}-{chunk.end}
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                {chunk.chunk_id}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-800">{chunk.transcript}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {chunk.concepts.map((concept) => (
                <span
                  key={concept}
                  className="rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
                >
                  {concept}
                </span>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <FileText className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  OCR Text
                </h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700">
                  {chunk.ocr.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <Eye className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                  Visual Description
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-700">{chunk.visual_description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

