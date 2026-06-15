"use client";

import {
  AlertTriangle,
  ArrowDown,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
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
import type {
  GenerateResponse,
  LectureSummary,
  LectureTimeline,
  OutputMode,
  ProcessingJob,
} from "@/lib/types";

const modeLabels: Record<OutputMode, string> = {
  structured_notes: "Visual Descriptions",
  adhd_study_pack: "ADHD/Focus Study Pack",
  screen_reader_notes: "Screen-reader Notes",
  exam_prep_pack: "Exam Review Pack",
  plain_language: "Plain-language Explanation",
  notetaker_quality_report: "Notetaker Quality Review",
  captions_vtt: "Caption Export",
  timeline_json: "Source Timeline",
  transcript_txt: "Transcript Export",
};

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
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
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
      setNotice(`Resumed ${formatJobKind(activeJob.kind).toLowerCase()} draft.`);
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
      setNotice(`${formatJobKind(completedJob.kind)} draft canceled.`);
      return;
    }
    if (completedJob.status === "failed") {
      throw new Error(completedJob.error || `${formatJobKind(completedJob.kind)} draft failed.`);
    }
    if (!completedJob.lecture_id) {
      throw new Error(`${formatJobKind(completedJob.kind)} draft finished without a review timeline.`);
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
      setNotice("Draft preparation canceled.");
      setIsBusy(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not cancel draft preparation.");
    }
  }

  async function handleLoadSample() {
    await runAction(async () => {
      const sample = await loadSampleLecture();
      setLecture(sample);
      setOutput(null);
      setNotice("Sample lecture loaded. Choose an accessibility goal to generate a draft.");
    });
  }

  async function handleCreateLecture(title: string, transcript: string) {
    await runAction(async () => {
      const created = await createLectureFromTranscript(title, transcript);
      const nextLecture = await getLecture(created.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
      await refreshRecentLectures();
      setNotice("Transcript timeline created. Review the chunks before exporting.");
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
      setNotice("Saved lecture loaded for review.");
    });
  }

  async function handleGenerate() {
    if (!lecture) {
      setError("Add lecture material before generating an accessible draft.");
      return;
    }

    await runAction(async () => {
      const generated = await generateOutput(lecture.lecture_id, selectedMode);
      setOutput(generated);
      setNotice(`${modeLabels[selectedMode]} draft generated. Review warnings and timestamps before sharing.`);
    });
  }

  const reviewWarnings = scanReviewMessages(lecture, processingJob);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fb] text-zinc-950">
      <Header />

      <section id="product" className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faf7_64%,#f7fbff_100%)]">
        <div className="mx-auto grid min-w-0 max-w-[1500px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8 lg:py-12">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              Draft — human review required
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Turn lecture materials into accessible study notes.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Upload permitted lecture recordings, transcripts, slides, or notes. AccessiNote creates reviewable
              formats for screen readers, focus support, plain-language review, visual descriptions, and notetaker
              workflows.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-11 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900"
              >
                <a href="#source-desk">
                  Create accessible notes
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
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
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
            <p className="text-sm font-semibold text-emerald-800">Review workspace</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Review timestamps, warnings, and draft notes before exporting
            </h2>
          </div>
          <Badge className="w-fit rounded-full bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Draft — human review required
          </Badge>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:items-start">
          <aside className="min-w-0 space-y-5" aria-label="Lecture timeline and source chunks">
            <LectureOverview lecture={lecture} />
            <RecentTimelines lectures={recentLectures} onLoad={handleLoadSavedLecture} disabled={isBusy} />
            <SourceSummary lecture={lecture} />
          </aside>

          <section className="min-w-0 space-y-5" aria-label="Generated output preview">
            <ModeSelector selectedMode={selectedMode} onSelectMode={setSelectedMode} disabled={!lecture || isBusy} />

            <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-950">{modeLabels[selectedMode]}</h3>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Generate a study draft from the reviewed timeline. Keep timestamps and warnings visible.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!lecture || isBusy}
                  aria-busy={isBusy}
                  className="min-h-11 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate draft
                </Button>
              </div>

              <div className="sr-only" aria-live="polite">
                {isBusy ? "Preparing draft." : output ? "Draft generated. Human review required." : ""}
              </div>

              {error && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                  {friendlyError(error)}
                </div>
              )}
              {notice && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                  {notice}
                </div>
              )}
            </Card>

            <OutputViewer output={output} />
          </section>

          <aside className="min-w-0 space-y-5" aria-label="Review checklist, warnings, and export options">
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
      title: "Add permitted material",
      detail: "Start from a transcript, notes, slides, image, caption file, or lecture recording you are allowed to use.",
    },
    {
      title: "Choose an accessibility goal",
      detail: "Pick screen-reader notes, a focus pack, plain-language review, visual descriptions, quality review, or exam prep.",
    },
    {
      title: "Generate a draft",
      detail: "AccessiNote prepares a reviewable draft with timestamps and source chunks.",
    },
    {
      title: "Review with warnings",
      detail: "Check unclear visual content, missing captions, low-confidence chunks, and anything a person should verify.",
    },
    {
      title: "Export when ready",
      detail: "Copy or download notes, captions, transcript text, or the source timeline after review.",
    },
  ];

  return (
    <section id="workflow" className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div>
          <p className="text-sm font-semibold text-emerald-800">How it works</p>
          <h2 className="mt-1 max-w-3xl text-2xl font-semibold tracking-normal text-zinc-950">
            From lecture material to reviewable accessible notes
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
      title: "Screen-reader notes",
      detail: "Linear reading order with visual descriptions and timestamp anchors.",
    },
    {
      icon: <Brain className="h-4 w-4" aria-hidden="true" />,
      title: "Focus-friendly study packs",
      detail: "Short start path, must-know ideas, quick checks, and overload recovery steps.",
    },
    {
      icon: <Languages className="h-4 w-4" aria-hidden="true" />,
      title: "Plain-language explanation",
      detail: "Simpler wording and smaller review stops for difficult lecture sections.",
    },
    {
      icon: <Eye className="h-4 w-4" aria-hidden="true" />,
      title: "Visual descriptions",
      detail: "Descriptions and captured slide text for material that is not only spoken aloud.",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
      title: "Notetaker quality checks",
      detail: "Warnings for missing, unclear, or low-confidence source material before sharing.",
    },
    {
      icon: <FileSearch className="h-4 w-4" aria-hidden="true" />,
      title: "Exam review pack",
      detail: "Flashcards, practice prompts, likely mistakes, and source-backed review points.",
    },
  ];

  return (
    <section id="formats" className="border-b border-zinc-200 bg-[#f7f9fb]">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-emerald-800">Accessibility goals</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
            Choose the format that matches the learner or notetaking task
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            AccessiNote keeps generated material as a draft so students, notetakers, and support staff can check it
            before use.
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
      title: "Screen-reader ready",
      detail: "Linear notes with visual context.",
    },
    {
      icon: <Brain className="h-4 w-4" aria-hidden="true" />,
      title: "Focus-friendly",
      detail: "Study paths that reduce overload.",
    },
    {
      icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
      title: "Human review built in",
      detail: "Warnings stay visible before export.",
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
      title: chunk.concepts[0] ?? chunk.chunk_id,
      detail: chunk.transcript,
    })) ?? [];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Lecture timeline</h2>
        <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50">
          {lecture ? `${lecture.chunks.length} chunks` : "No source"}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-950">{lecture ? lecture.title : "No lecture loaded"}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          {lecture ? lecture.source.attribution || lecture.source.type : "Add a source or try the sample lecture."}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {(timelineItems.length > 0 ? timelineItems : placeholderTimeline).map((item) => (
          <div key={`${item.start}-${item.title}`} className="grid grid-cols-[60px_minmax(0,1fr)] gap-3">
            <span className="text-xs font-semibold text-emerald-700">{item.start}</span>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <p className="truncate text-sm font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">{item.detail}</p>
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
        <h2 className="text-base font-semibold text-zinc-950">Recent drafts</h2>
        <Badge variant="secondary" className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {lectures.length}
        </Badge>
      </div>

      {lectures.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Drafts created from transcripts, slides, and recordings will appear here on this device.
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
              <span className="block truncate text-sm font-semibold text-zinc-950">{item.title}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-xs font-medium text-zinc-600">
                <span>{formatSourceType(item.source_type)}</span>
                <span>{item.chunk_count} chunks</span>
                <span>{item.ocr_chunk_count} visual text</span>
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
        Source summary
      </h2>
      <div className="mt-4 grid gap-3">
        <SummaryRow label="Material" value={lecture ? formatSourceType(lecture.source.type) : "Not added"} />
        <SummaryRow label="Timeline chunks" value={lecture ? String(lecture.chunks.length) : "0"} />
        <SummaryRow label="Visual text captured" value={lecture ? String(visualTextChunks) : "0"} />
        <SummaryRow label="Review warnings" value={String(warningCount)} />
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
      label: "Permitted material added",
      complete: Boolean(lecture),
    },
    {
      label: "Accessibility goal selected",
      complete: true,
    },
    {
      label: "Draft generated",
      complete: Boolean(output),
    },
    {
      label: "Warnings reviewed",
      complete: Boolean(output && warnings.length === 0),
    },
    {
      label: "Timestamps checked",
      complete: Boolean(output && lecture?.chunks.length),
    },
  ];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <ListChecks className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Review checklist
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Complete these checks before copying, downloading, or sharing a draft.
      </p>
      <div className="mt-4 space-y-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2 ring-1 ring-zinc-200">
            {item.complete ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            )}
            <span className="text-sm font-medium text-zinc-800">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WarningsPanel({ warnings, job }: { warnings: string[]; job: ProcessingJob | null }) {
  const visibleWarnings = [...warnings];
  if (job?.status === "failed") {
    visibleWarnings.unshift("AccessiNote could not finish preparing this source. Try a shorter file or attach transcript text.");
  }
  if (job?.status === "canceled") {
    visibleWarnings.unshift("Draft preparation was canceled. Add a source again when ready.");
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
          No warnings yet. After generating a draft, still check timestamps and source details manually.
        </p>
      )}
    </Card>
  );
}

function ExportOptionsPanel({ output }: { output: GenerateResponse | null }) {
  const options = [
    "Copy reviewed notes",
    "Download Markdown",
    "Download captions",
    "Download transcript",
    "Download source timeline",
  ];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <Download className="h-4 w-4 text-emerald-700" aria-hidden="true" />
        Export options
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Export buttons appear in the generated draft preview. Export only after human review.
      </p>
      <div className="mt-4 space-y-2">
        {options.map((option) => (
          <p key={option} className="flex items-center gap-2 text-sm text-zinc-700">
            <CheckCircle2 className={`h-4 w-4 ${output ? "text-emerald-700" : "text-zinc-400"}`} aria-hidden="true" />
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
        Privacy-conscious prototype
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Use permitted material only and review every generated draft. Do not upload private student data, exams,
        accommodation records, or unauthorized recordings.
      </p>
    </Card>
  );
}

function formatSourceType(value: string): string {
  if (value === "video") {
    return "Recording";
  }
  if (value === "image") {
    return "Slides or image";
  }
  if (value === "transcript") {
    return "Transcript";
  }
  return value || "Source";
}

function formatJobKind(kind: string): string {
  if (kind === "image") {
    return "Image";
  }
  return "Recording";
}

function scanReviewMessages(lecture: LectureTimeline | null, job: ProcessingJob | null): string[] {
  const messages: string[] = [];
  if (job?.status === "failed") {
    messages.push("Draft preparation failed before a review timeline could be created.");
  }
  if (job?.status === "canceled") {
    messages.push("Draft preparation was canceled.");
  }
  if (!lecture) {
    return messages;
  }

  const metrics = lecture.processing_metadata.metrics;
  if (lecture.source.type === "video" && lecture.caption_segments.length === 0) {
    messages.push("No captions are attached. Add captions or verify audio details manually.");
  }
  if ((lecture.source.type === "video" || lecture.source.type === "image") && metrics.ocr_frame_count === 0) {
    messages.push("No readable visual text was found. Review slides, diagrams, and board work manually.");
  }
  if (metrics.average_source_confidence < 0.65) {
    messages.push("Some source details need review. Treat generated notes as a draft and verify important details.");
  }
  if (metrics.weak_chunk_count > 0) {
    messages.push(`${metrics.weak_chunk_count} timeline chunk(s) need human review before sharing.`);
  }
  return messages.slice(0, 4);
}

function describeCompletedJob(job: ProcessingJob): string {
  if (job.kind === "image") {
    return "Slide or image draft created. Review visual text and notes before exporting.";
  }
  return "Recording draft created with timestamps and review notes. Check warnings before exporting.";
}

function friendlyError(error: string): string {
  const normalized = error.toLowerCase();
  if (normalized.includes("unsupported file type")) {
    return "This file type is not supported. Try a transcript, caption file, slide image, or lecture recording.";
  }
  if (normalized.includes("too large")) {
    return "This file is too large for the current draft workflow. Try a shorter recording or smaller file.";
  }
  return error;
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
    title: "Add lecture material",
    detail: "Timeline chunks, timestamps, captions, visual notes, and warnings will appear here.",
  },
  {
    start: "08:45",
    title: "Choose accessibility goal",
    detail: "Generate screen-reader notes, a focus pack, plain-language review, or quality checks.",
  },
  {
    start: "22:10",
    title: "Review before export",
    detail: "Check warnings and timestamps before sharing or using the draft.",
  },
];
