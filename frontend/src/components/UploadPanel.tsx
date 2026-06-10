"use client";

import { FileText, Loader2, Play, PlusCircle } from "lucide-react";
import { FormEvent, useState } from "react";

interface UploadPanelProps {
  onLoadSample: () => Promise<void>;
  onCreateLecture: (title: string, transcript: string) => Promise<void>;
  isBusy: boolean;
}

export function UploadPanel({ onLoadSample, onCreateLecture, isBusy }: UploadPanelProps) {
  const [title, setTitle] = useState("My Local Transcript");
  const [transcript, setTranscript] = useState("");

  async function submitTranscript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreateLecture(title, transcript);
  }

  return (
    <section className="space-y-5">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <Play className="h-5 w-5 text-emerald-700" aria-hidden="true" />
          Start
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Load the built-in synthetic lecture or paste a transcript to create a local timeline.
        </p>
        <button
          type="button"
          onClick={onLoadSample}
          disabled={isBusy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Load Sample Lecture
        </button>
      </div>

      <form onSubmit={submitTranscript} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-soft">
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
          className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
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
          className="mt-2 w-full resize-y rounded-md border border-zinc-300 px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          disabled={isBusy || transcript.trim().length === 0}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          Create Timeline
        </button>
      </form>
    </section>
  );
}

