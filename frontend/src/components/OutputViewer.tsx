"use client";

import { AlertTriangle, ChevronDown, Clipboard, Download, FileDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GenerateResponse } from "@/lib/types";

interface OutputViewerProps {
  output: GenerateResponse | null;
}

export function OutputViewer({ output }: OutputViewerProps) {
  async function copyMarkdown() {
    if (!output) {
      return;
    }
    await navigator.clipboard.writeText(output.content_markdown);
  }

  function downloadMarkdown() {
    if (!output) {
      return;
    }
    const fileType = outputFileType(output.mode);
    const blob = new Blob([output.content_markdown], {
      type: fileType.mime,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${output.lecture_id}-${output.mode}.${fileType.extension}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!output) {
    return (
      <Card className="rounded-2xl border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-700 shadow-none">
        <p className="font-semibold text-zinc-950">Generated output preview</p>
        <p className="mt-1 max-w-2xl">
          Choose a format and generate an accessible draft. Source checkpoints will stay available without crowding
          the student-facing material.
        </p>
      </Card>
    );
  }

  const isPlainPreview = output.mode === "captions_vtt" || output.mode === "timeline_json" || output.mode === "transcript_txt";
  const fileType = outputFileType(output.mode);
  const topSources = output.sources.slice(0, 5);
  const hiddenSourceCount = Math.max(0, output.sources.length - topSources.length);

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Generated draft</p>
          <h2 className="text-lg font-semibold tracking-normal text-zinc-950">{output.title}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={copyMarkdown}
            variant="outline"
            className="min-h-11 border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 active:translate-y-px active:bg-zinc-200"
          >
            <Clipboard className="h-4 w-4" aria-hidden="true" />
            Copy {fileType.label}
          </Button>
          <Button
            type="button"
            onClick={downloadMarkdown}
            className="min-h-11 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download .{fileType.extension}
          </Button>
        </div>
      </div>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Draft - human review required. Check timestamps, visual details, and warnings before sharing or using this
          material.
        </p>
      </div>

      {output.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          {output.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="prose prose-zinc max-w-none p-4 prose-headings:tracking-normal prose-h1:text-2xl prose-h2:text-lg prose-li:my-1 prose-p:leading-7">
          {isPlainPreview ? (
            <pre className="whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-sm leading-6 text-zinc-50">
              {output.content_markdown}
            </pre>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{output.content_markdown}</ReactMarkdown>
          )}
        </article>
        <aside className="border-t border-zinc-200 p-4 lg:border-l lg:border-t-0">
          <details className="group rounded-xl border border-zinc-200 bg-zinc-50 p-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                <FileDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                Source used
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Top checkpoints used for this draft. Open the timeline or source timeline export for the full trail.
            </p>

            {topSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {topSources.map((source) => (
                  <div key={source.chunk_id} className="rounded-lg bg-white p-3 text-sm leading-5 text-zinc-700 ring-1 ring-zinc-200">
                    <p className="font-semibold text-zinc-950">
                      {source.chunk_id} - {source.start}-{source.end}
                    </p>
                    <p className="mt-1">{source.reason}</p>
                  </div>
                ))}
                {hiddenSourceCount > 0 && (
                  <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                    {hiddenSourceCount} more checkpoint(s) available in the timeline and source timeline export.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-zinc-700 ring-1 ring-zinc-200">
                This export does not include source checkpoints. Review the timeline before using it.
              </p>
            )}
          </details>
        </aside>
      </div>
    </Card>
  );
}

function outputFileType(mode: GenerateResponse["mode"]): { extension: string; mime: string; label: string } {
  if (mode === "captions_vtt") {
    return { extension: "vtt", mime: "text/vtt;charset=utf-8", label: "VTT" };
  }
  if (mode === "timeline_json") {
    return { extension: "json", mime: "application/json;charset=utf-8", label: "source timeline" };
  }
  if (mode === "transcript_txt") {
    return { extension: "txt", mime: "text/plain;charset=utf-8", label: "text" };
  }
  return { extension: "md", mime: "text/markdown;charset=utf-8", label: "Markdown" };
}
