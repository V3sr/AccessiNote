"use client";

import { Clipboard, Download, FileDown } from "lucide-react";
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
    const blob = new Blob([output.content_markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${output.lecture_id}-${output.mode}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!output) {
    return (
      <Card className="rounded-2xl border-dashed border-zinc-300 bg-white p-6 text-sm leading-6 text-zinc-700 shadow-none">
        <p className="font-semibold text-zinc-950">Generated output preview</p>
        <p className="mt-1 max-w-2xl">
          Generate an output to preview rewritten markdown, source references, warnings, and export controls.
        </p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Generated output</p>
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
            Copy
          </Button>
          <Button
            type="button"
            onClick={downloadMarkdown}
            className="min-h-11 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download
          </Button>
        </div>
      </div>

      {output.warnings.length > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          {output.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="prose prose-zinc max-w-none p-4 prose-headings:tracking-normal prose-h1:text-2xl prose-h2:text-lg prose-li:my-1">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{output.content_markdown}</ReactMarkdown>
        </article>
        <aside className="border-t border-zinc-200 p-4 lg:border-l lg:border-t-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
            <FileDown className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            Source References
          </h3>
          <div className="mt-3 space-y-3">
            {output.sources.map((source) => (
              <div key={source.chunk_id} className="rounded-xl bg-zinc-50 p-3 text-sm leading-5 text-zinc-700">
                <p className="font-semibold text-zinc-950">
                  {source.chunk_id} - {source.start}-{source.end}
                </p>
                <p className="mt-1">{source.reason}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Card>
  );
}
