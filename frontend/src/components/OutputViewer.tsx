"use client";

import { AlertTriangle, ChevronDown, Clipboard, Download, FileDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { countOf, friendlyWarnings, partLabel } from "@/lib/messages";
import { modeLabel } from "@/lib/modes";
import type { GenerateResponse } from "@/lib/types";

interface OutputViewerProps {
  output: GenerateResponse | null;
}

// Generated notes start at their own h1. The card title is an h2, so note headings move down two levels.
const markdownComponents: Components = {
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h5>{children}</h5>,
  h4: ({ children }) => <h6>{children}</h6>,
  input: ({ type, checked, disabled }) => (
    <input type={type} checked={checked} disabled={disabled} readOnly aria-label={checked ? "Done" : "To do"} />
  ),
};

export function OutputViewer({ output }: OutputViewerProps) {
  // Keyed to the output it belongs to, so a new set of notes starts with no message.
  const [copyResult, setCopyResult] = useState<{ output: GenerateResponse; message: string } | null>(null);

  async function copyMarkdown() {
    if (!output) {
      return;
    }
    try {
      await navigator.clipboard.writeText(output.content_markdown);
      setCopyResult({ output, message: `Copied the ${outputFileType(output.mode).label}.` });
    } catch {
      setCopyResult({ output, message: "Could not copy. Select the text and copy it yourself." });
    }
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
        <p className="font-semibold text-zinc-950">Your notes show up here</p>
        <p className="mt-1 max-w-2xl">
          Pick a format above, then select Make notes. The parts each note came from are listed beside it.
        </p>
      </Card>
    );
  }

  const isPlainPreview = output.mode === "captions_vtt" || output.mode === "timeline_json" || output.mode === "transcript_txt";
  const fileType = outputFileType(output.mode);
  const topSources = output.sources.slice(0, 5);
  const hiddenSourceCount = Math.max(0, output.sources.length - topSources.length);
  const warnings = friendlyWarnings(output.warnings);
  const copyMessage = copyResult?.output === output ? copyResult.message : "";

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Your notes</p>
          <h2 className="text-lg font-semibold tracking-normal text-zinc-950">{modeLabel(output.mode)}</h2>
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
            Download {fileType.label} (.{fileType.extension})
          </Button>
        </div>
      </div>
      <p role="status" className={copyMessage ? "border-b border-zinc-200 px-4 py-2 text-sm text-zinc-700" : "sr-only"}>
        {copyMessage}
      </p>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <p className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          These notes may have mistakes. Check the timestamps, slide details and warnings before you study from them
          or share them.
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="prose prose-zinc max-w-none p-4 prose-headings:tracking-normal prose-h3:text-2xl prose-h4:text-lg prose-h5:text-base prose-h5:font-semibold prose-li:my-1 prose-p:leading-7">
          {isPlainPreview ? (
            <pre className="whitespace-pre-wrap rounded-md bg-zinc-950 p-4 text-sm leading-6 text-zinc-50">
              {output.content_markdown}
            </pre>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {output.content_markdown}
            </ReactMarkdown>
          )}
        </article>
        <aside className="border-t border-zinc-200 p-4 lg:border-l lg:border-t-0">
          <details className="group rounded-xl border border-zinc-200 bg-zinc-50 p-3" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                <FileDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                Where these notes came from
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-600 transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              These parts shaped your notes. Open the timeline to see every part.
            </p>

            {topSources.length > 0 ? (
              <div className="mt-3 space-y-2">
                {topSources.map((source) => (
                  <div key={source.chunk_id} className="rounded-lg bg-white p-3 text-sm leading-5 text-zinc-700 ring-1 ring-zinc-200">
                    <p className="font-semibold text-zinc-950">
                      {partLabel(source.chunk_id)}, {source.start}-{source.end}
                    </p>
                    <p className="mt-1">{source.reason.replace(/^Used for:\s*/, "")}</p>
                  </div>
                ))}
                {hiddenSourceCount > 0 && (
                  <p className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                    {countOf(hiddenSourceCount, "more part is", "more parts are")} in the timeline below.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-zinc-700 ring-1 ring-zinc-200">
                This export does not list its parts. Check the timeline below before you use it.
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
    return { extension: "vtt", mime: "text/vtt;charset=utf-8", label: "captions" };
  }
  if (mode === "timeline_json") {
    return { extension: "json", mime: "application/json;charset=utf-8", label: "full record" };
  }
  if (mode === "transcript_txt") {
    return { extension: "txt", mime: "text/plain;charset=utf-8", label: "transcript" };
  }
  return { extension: "md", mime: "text/markdown;charset=utf-8", label: "notes" };
}
