"use client";

import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileCheck2,
  FileSearch,
  FileText,
  Glasses,
  Languages,
  ListChecks,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { ModeSelector } from "@/components/ModeSelector";
import { OutputViewer } from "@/components/OutputViewer";
import { SafetyBanner } from "@/components/SafetyBanner";
import { TimelineViewer } from "@/components/TimelineViewer";
import { UploadPanel } from "@/components/UploadPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  cancelProcessingJob,
  createLectureFromTranscript,
  generateOutput,
  getLecture,
  getProcessingJob,
  listLectures,
  listProcessingJobs,
  loadSampleLecture,
  startMediaJob,
} from "@/lib/api";
import { countOf, formatAttribution, friendlyError, partLabel } from "@/lib/messages";
import { modeLabel } from "@/lib/modes";
import type {
  GenerateResponse,
  LectureSummary,
  LectureTimeline,
  OutputMode,
  ProcessingJob,
} from "@/lib/types";

export default function Home() {
  const [lecture, setLecture] = useState<LectureTimeline | null>(null);
  const [selectedMode, setSelectedMode] = useState<OutputMode>("adhd_study_pack");
  const [output, setOutput] = useState<GenerateResponse | null>(null);
  const [recentLectures, setRecentLectures] = useState<LectureSummary[]>([]);
  const [processingJob, setProcessingJob] = useState<ProcessingJob | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    refreshRecentLectures();
    void resumeActiveProcessingJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshRecentLectures() {
    try {
      const lectures = await listLectures();
      setRecentLectures(lectures);
    } catch {
      setRecentLectures([]);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (caughtError) {
      console.error("AccessiNote error:", caughtError);
      setError(friendlyError(caughtError instanceof Error ? caughtError.message : String(caughtError)));
    } finally {
      setIsBusy(false);
    }
  }

  async function resumeActiveProcessingJob() {
    try {
      const activeJobs = await listProcessingJobs(true);
      const activeJob = activeJobs[0];
      if (!activeJob) {
        return;
      }
      setProcessingJob(activeJob);
      setNotice(`Still working on your ${formatJobKind(activeJob.kind).toLowerCase()}.`);
      setIsBusy(true);
      try {
        await continueProcessingJob(activeJob);
      } finally {
        setIsBusy(false);
      }
    } catch {
      // Best-effort resume; visible errors come from user-triggered actions.
    }
  }

  async function continueProcessingJob(startJob: ProcessingJob) {
    setProcessingJob(startJob);
    const completedJob = await waitForProcessingJob(startJob.job_id, setProcessingJob);
    if (completedJob.status === "canceled") {
      setNotice("Upload stopped. Add the file again when you are ready.");
      return;
    }
    if (completedJob.status === "failed") {
      throw new Error(completedJob.error || "processing failed");
    }
    if (!completedJob.lecture_id) {
      throw new Error("processing finished without a timeline");
    }

    const nextLecture = await getLecture(completedJob.lecture_id);
    setLecture(nextLecture);
    setOutput(null);
    await refreshRecentLectures();
    setNotice(describeCompletedJob(completedJob));
  }

  async function handleCancelProcessingJob(jobId: string) {
    setError(null);
    try {
      const canceledJob = await cancelProcessingJob(jobId);
      setProcessingJob(canceledJob);
      setNotice("Upload stopped. Add the file again when you are ready.");
      setIsBusy(false);
    } catch {
      setError("AccessiNote could not stop the upload. Wait for it to finish, or reload the page.");
    }
  }

  async function handleLoadSample() {
    await runAction(async () => {
      const sample = await loadSampleLecture();
      setLecture(sample);
      setOutput(null);
      setNotice("Sample lecture ready. Pick a format, then select Make notes.");
    });
  }

  async function handleCreateLecture(title: string, transcript: string) {
    await runAction(async () => {
      const created = await createLectureFromTranscript(title, transcript);
      const nextLecture = await getLecture(created.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
      await refreshRecentLectures();
      setNotice("Your transcript is ready. Skim each part before you export.");
    });
  }

  async function handleUploadVideo(title: string, videoFile: File, transcript: string, transcriptFile?: File | null) {
    await runAction(async () => {
      const createdJob = await startMediaJob("video", title, videoFile, transcript, transcriptFile);
      await continueProcessingJob(createdJob);
    });
  }

  async function handleUploadImage(title: string, imageFile: File, notes: string) {
    await runAction(async () => {
      const createdJob = await startMediaJob("image", title, imageFile, notes);
      await continueProcessingJob(createdJob);
    });
  }

  async function handleLoadSavedLecture(lectureId: string) {
    await runAction(async () => {
      const nextLecture = await getLecture(lectureId);
      setLecture(nextLecture);
      setOutput(null);
      setNotice("Lecture reopened. Pick a format, then select Make notes.");
    });
  }

  async function handleGenerate() {
    if (!lecture) {
      setError("Add a lecture first, then select Make notes.");
      return;
    }

    await runAction(async () => {
      const generated = await generateOutput(lecture.lecture_id, selectedMode);
      setOutput(generated);
      setNotice(`${modeLabel(selectedMode)} ready. Check the warnings and timestamps before you share.`);
    });
  }

  const reviewWarnings = scanReviewMessages(lecture, processingJob);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fb] text-zinc-950">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:shadow-soft"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main">
        <section id="product" className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faf7_64%,#f7fbff_100%)]">
          <div className="mx-auto grid min-w-0 max-w-[1500px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8 lg:py-12">
            <div className="min-w-0">
              <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
                <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                Check before you share
              </Badge>
              <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
                Turn a lecture into notes that fit how you study.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
                Captions, screen reader notes, short study steps or plain words. Add a recording, transcript or slide
                you are allowed to use, then check the notes before you share them.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                  asChild
                  className="min-h-11 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900"
                >
                  <a href="#source-desk">
                    Add a lecture
                    <ArrowDown className="h-4 w-4" aria-hidden="true" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadSample}
                  disabled={isBusy}
                  className="min-h-11 rounded-md border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px active:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}
                  Try sample lecture
                </Button>
              </div>

              <BenefitGrid />
            </div>

            <UploadPanel
              onLoadSample={handleLoadSample}
              onCreateLecture={handleCreateLecture}
              onUploadVideo={handleUploadVideo}
              onUploadImage={handleUploadImage}
              isBusy={isBusy}
              processingJob={processingJob}
              onCancelProcessingJob={handleCancelProcessingJob}
            />
          </div>
        </section>

        <SafetyBanner />
        <WorkflowSection />
        <FormatsSection />

        <section id="workbench" className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">Your notes</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
                Check timestamps and warnings before you export
              </h2>
            </div>
            <Badge className="w-fit rounded-full bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              Check before you share
            </Badge>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:items-start">
            <aside className="min-w-0 space-y-5" aria-label="Lecture timeline and parts">
              <LectureOverview lecture={lecture} />
              <RecentTimelines lectures={recentLectures} onLoad={handleLoadSavedLecture} disabled={isBusy} />
              <SourceSummary lecture={lecture} />
            </aside>

            <section className="min-w-0 space-y-5" aria-label="Your notes">
              <ModeSelector selectedMode={selectedMode} onSelectMode={setSelectedMode} disabled={!lecture || isBusy} />

              <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-950">{modeLabel(selectedMode)}</h3>
                    <p className="mt-1 text-sm leading-5 text-zinc-600">
                      {lecture
                        ? "Make notes from this lecture. Timestamps and warnings stay with them."
                        : "Add a lecture first, then make notes."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!lecture || isBusy}
                    aria-busy={isBusy}
                    className="min-h-11 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                    Make notes
                  </Button>
                </div>

                <div className="sr-only" aria-live="polite">
                  {isBusy ? "Working on it." : output ? "Notes ready. Check them before you share." : ""}
                </div>

                <div role="alert">
                  {error && (
                    <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                      {error}
                    </div>
                  )}
                </div>
                <div role="status">
                  {notice && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                      {notice}
                    </div>
                  )}
                </div>
              </Card>

              <OutputViewer output={output} />
            </section>

            <aside className="min-w-0 space-y-5" aria-label="Checklist, warnings and export">
              <ReviewChecklistPanel lecture={lecture} output={output} warnings={reviewWarnings} />
              <WarningsPanel warnings={reviewWarnings} job={processingJob} />
              <ExportOptionsPanel output={output} />
              <PrivacyPanel />
            </aside>
          </div>

          <div className="mt-5">
            <TimelineViewer lecture={lecture} />
          </div>
        </section>
      </main>
    </div>
  );
}

async function waitForProcessingJob(
  jobId: string,
  onUpdate: (job: ProcessingJob) => void,
): Promise<ProcessingJob> {
  let latest = await getProcessingJob(jobId);
  onUpdate(latest);
  while (latest.status === "queued" || latest.status === "running") {
    await delay(900);
    latest = await getProcessingJob(jobId);
    onUpdate(latest);
  }
  return latest;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function WorkflowSection() {
  const steps = [
    {
      title: "Add material you are allowed to use",
      detail: "Use a transcript, slides, a captions file or a lecture recording.",
    },
    {
      title: "Pick a format",
      detail: "Choose screen reader notes, an ADHD study pack, a plain-language explanation, structured notes, an exam prep pack or a notetaker quality report.",
    },
    {
      title: "Make notes",
      detail: "AccessiNote writes notes with timestamps that link back to the lecture.",
    },
    {
      title: "Check the warnings",
      detail: "Look at unclear slides, missing captions and any part AccessiNote is unsure about.",
    },
    {
      title: "Export when ready",
      detail: "Copy or download notes, captions, a transcript or the full record.",
    },
  ];

  return (
    <section id="workflow" className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-emerald-800">How it works</p>
          <h2 className="mt-1 max-w-3xl text-2xl font-semibold tracking-normal text-zinc-950">
            From lecture to notes you can check
          </h2>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {steps.map((step, index) => (
            <Card key={step.title} className="rounded-2xl border-zinc-200 bg-zinc-50 p-4 shadow-none">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-zinc-950">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{step.detail}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function FormatsSection() {
  const formats = [
    {
      icon: <Glasses className="h-4 w-4" aria-hidden="true" />,
      title: "Screen reader notes",
      detail: "One reading order, with slide text, visual notes and timestamps.",
    },
    {
      icon: <Brain className="h-4 w-4" aria-hidden="true" />,
      title: "ADHD study pack",
      detail: "A 3-minute start, must-know terms, quick checks and what to do when it gets too much.",
    },
    {
      icon: <Languages className="h-4 w-4" aria-hidden="true" />,
      title: "Plain-language explanation",
      detail: "Simpler words and short stops for the hard parts of a lecture.",
    },
    {
      icon: <BookOpen className="h-4 w-4" aria-hidden="true" />,
      title: "Structured notes",
      detail: "Main ideas, key terms and timestamps in one outline.",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
      title: "Notetaker quality report",
      detail: "Scores and a list of what to check before notes are shared.",
    },
    {
      icon: <FileSearch className="h-4 w-4" aria-hidden="true" />,
      title: "Exam prep pack",
      detail: "Flashcards, practice prompts and mistakes to avoid, each with a timestamp.",
    },
  ];

  return (
    <section id="formats" className="border-b border-zinc-200 bg-[#f7f9fb]">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-emerald-800">Formats</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
            Pick the format that fits how you study
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            Every format is a starting point. Check it before you study from it or share it.
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {formats.map((item) => (
            <BenefitCard key={item.title} icon={item.icon} title={item.title} detail={item.detail} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BenefitGrid() {
  const items = [
    {
      icon: <Glasses className="h-4 w-4" aria-hidden="true" />,
      title: "Screen reader notes",
      detail: "One reading order, with slide text.",
    },
    {
      icon: <Brain className="h-4 w-4" aria-hidden="true" />,
      title: "ADHD study packs",
      detail: "Short steps that start small.",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
      title: "You check before you share",
      detail: "Warnings stay in view until you export.",
    },
  ];

  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <HeroBenefit key={item.title} icon={item.icon} title={item.title} detail={item.detail} />
      ))}
    </div>
  );
}

function HeroBenefit({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <Card className="flex items-start gap-3 rounded-xl border-white bg-white/70 p-3 shadow-soft">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-zinc-950">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-zinc-600">{detail}</span>
      </span>
    </Card>
  );
}

function BenefitCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-none">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        {icon}
      </span>
      <h3 className="mt-4 text-base font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{detail}</p>
    </Card>
  );
}

function LectureOverview({ lecture }: { lecture: LectureTimeline | null }) {
  const timelineItems =
    lecture?.chunks.slice(0, 5).map((chunk) => ({
      start: chunk.start,
      title: chunk.concepts[0] ?? partLabel(chunk.chunk_id),
      detail: chunk.transcript,
    })) ?? [];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Lecture timeline</h2>
        <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50">
          {lecture ? countOf(lecture.chunks.length, "part", "parts") : "Nothing added"}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-950">{lecture ? lecture.title : "No lecture yet"}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          {lecture ? formatAttribution(lecture.source.attribution, lecture.source.type) : "Add a lecture above, or try the sample."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {(timelineItems.length > 0 ? timelineItems : placeholderTimeline).map((item) => (
          <div key={`${item.start}-${item.title}`} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3">
            <span className="text-xs font-semibold text-emerald-700">{item.start}</span>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <p className="break-words text-sm font-semibold text-zinc-900">{item.title}</p>
              {/* Real parts show a short preview (the full text is in the timeline below); the placeholder steps show in full. */}
              <p className={`mt-1 text-xs leading-5 text-zinc-600 ${timelineItems.length > 0 ? "line-clamp-2" : ""}`}>
                {item.detail}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentTimelines({
  lectures,
  onLoad,
  disabled,
}: {
  lectures: LectureSummary[];
  onLoad: (lectureId: string) => void;
  disabled: boolean;
}) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Recent lectures</h2>
        <Badge variant="secondary" className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {lectures.length}
        </Badge>
      </div>

      {lectures.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Lectures you add show up here, on this computer only.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {lectures.slice(0, 5).map((item) => (
            <button
              key={item.lecture_id}
              type="button"
              onClick={() => onLoad(item.lecture_id)}
              disabled={disabled}
              className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:bg-zinc-50 active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-50"
            >
              <span className="block break-words text-sm font-semibold text-zinc-950">{item.title}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-zinc-600">
                <span>{formatSourceType(item.source_type)}</span>
                <span>{countOf(item.chunk_count, "part", "parts")}</span>
                <span>slide text on {item.ocr_chunk_count}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function SourceSummary({ lecture }: { lecture: LectureTimeline | null }) {
  const visualTextChunks = lecture?.chunks.filter((chunk) => hasReadableOcrEvidence(chunk.ocr)).length ?? 0;
  const warningCount = scanReviewMessages(lecture, null).length;

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <FileText className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        This lecture
      </h2>
      <div className="mt-4 grid gap-3">
        <SummaryRow label="Type" value={lecture ? formatSourceType(lecture.source.type) : "Nothing added"} />
        <SummaryRow label="Parts" value={lecture ? String(lecture.chunks.length) : "0"} />
        <SummaryRow label="Parts with slide text" value={lecture ? String(visualTextChunks) : "0"} />
        <SummaryRow label="Warnings" value={String(warningCount)} />
      </div>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="truncate text-right font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function ReviewChecklistPanel({
  lecture,
  output,
  warnings,
}: {
  lecture: LectureTimeline | null;
  output: GenerateResponse | null;
  warnings: string[];
}) {
  const checklist = [
    {
      label: "Add material you are allowed to use",
      complete: Boolean(lecture),
    },
    {
      label: "Pick a format",
      complete: true,
    },
    {
      label: "Make notes",
      complete: Boolean(output),
    },
    {
      label: "Read the warnings",
      complete: Boolean(output && warnings.length === 0),
    },
    {
      label: "Check the timestamps",
      complete: Boolean(output && lecture?.chunks.length),
    },
  ];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <ListChecks className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Before you share
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Work through these before you copy, download or share your notes.
      </p>
      <div className="mt-4 space-y-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2 ring-1 ring-zinc-200">
            {item.complete ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-zinc-800">
              <span className="sr-only">{item.complete ? "Done: " : "To do: "}</span>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WarningsPanel({ warnings, job }: { warnings: string[]; job: ProcessingJob | null }) {
  const visibleWarnings = [...warnings];
  if (job?.status === "failed") {
    visibleWarnings.unshift("AccessiNote could not finish this upload. Try a shorter file, or add a transcript with it.");
  }
  if (job?.status === "canceled") {
    visibleWarnings.unshift("Upload stopped. Add the file again when you are ready.");
  }

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <AlertTriangle className="h-4 w-4 text-amber-700" aria-hidden="true" />
        Warnings
      </h2>
      {visibleWarnings.length > 0 ? (
        <div className="mt-3 space-y-2">
          {visibleWarnings.map((warning) => (
            <p
              key={warning}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          No warnings yet. Still check the timestamps and slide details yourself.
        </p>
      )}
    </Card>
  );
}

function ExportOptionsPanel({ output }: { output: GenerateResponse | null }) {
  const options = [
    "Copy notes",
    "Download notes (Markdown)",
    "Download captions",
    "Download transcript",
    "Download the full record",
  ];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <Download className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Export
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Export buttons show up on your notes once you make them. Check the notes first.
      </p>
      <div className="mt-4 space-y-2">
        {options.map((option) => (
          <p key={option} className="flex items-center gap-2 text-sm text-zinc-700">
            <CheckCircle2 className={`h-4 w-4 ${output ? "text-emerald-700" : "text-zinc-400"}`} aria-hidden="true" />
            <span className="sr-only">{output ? "Available: " : "Not yet: "}</span>
            {option}
          </p>
        ))}
      </div>
    </Card>
  );
}

function PrivacyPanel() {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <ClipboardCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
        Keep it private
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Use only material you are allowed to use, and check every set of notes. Do not upload private student data,
        exams, accommodation records or recordings you do not have permission for.
      </p>
    </Card>
  );
}

function formatSourceType(value: string): string {
  if (value === "video") {
    return "Recording";
  }
  if (value === "image") {
    return "Slide or image";
  }
  if (value === "transcript") {
    return "Transcript";
  }
  return value || "Lecture";
}

function formatJobKind(kind: string): string {
  if (kind === "image") {
    return "Slide";
  }
  return "Recording";
}

function scanReviewMessages(lecture: LectureTimeline | null, job: ProcessingJob | null): string[] {
  const messages: string[] = [];
  if (job?.status === "failed") {
    messages.push("The upload stopped before AccessiNote could build a timeline. Try again with a shorter file.");
  }
  if (job?.status === "canceled") {
    messages.push("Upload stopped.");
  }
  if (!lecture) {
    return messages;
  }

  const metrics = lecture.processing_metadata.metrics;
  if (lecture.source.type === "video" && lecture.caption_segments.length === 0) {
    messages.push("No captions. Add a captions file, or check what was said yourself.");
  }
  if ((lecture.source.type === "video" || lecture.source.type === "image") && metrics.ocr_frame_count === 0) {
    messages.push("No slide text found. Check the slides, diagrams and board work yourself.");
  }
  if (metrics.average_source_confidence < 0.65) {
    messages.push("AccessiNote is unsure about some of this lecture. Check important details against the recording or slides.");
  }
  if (metrics.weak_chunk_count > 0) {
    messages.push(`Check ${countOf(metrics.weak_chunk_count, "part", "parts")} in the timeline below before you share your notes.`);
  }
  return messages.slice(0, 4);
}

function describeCompletedJob(job: ProcessingJob): string {
  if (job.kind === "image") {
    return "Your slide is ready. Check the slide text, then pick a format.";
  }
  return "Your recording is ready, with timestamps. Check the warnings, then pick a format.";
}

function hasReadableOcrEvidence(items: string[]): boolean {
  return items.some(
    (item) =>
      item.trim().length > 0 &&
      !item.toLowerCase().startsWith("no ocr") &&
      !item.toLowerCase().includes("no readable text"),
  );
}

const placeholderTimeline = [
  {
    start: "00:00",
    title: "Add a lecture",
    detail: "Its parts, timestamps, captions, slide text and warnings show up here.",
  },
  {
    start: "08:45",
    title: "Pick a format",
    detail: "Make screen reader notes, an ADHD study pack, a plain-language explanation or a notetaker quality report.",
  },
  {
    start: "22:10",
    title: "Check before you export",
    detail: "Look at the warnings and timestamps before you share or use your notes.",
  },
];
