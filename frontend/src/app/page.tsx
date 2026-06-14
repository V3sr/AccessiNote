"use client";

import {
  Activity,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileCheck2,
  HardDrive,
  Loader2,
  ScanText,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  XCircle,
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
  getCapabilities,
  getDemoStatus,
  getHealth,
  getLecture,
  getProcessingJob,
  listProcessingJobs,
  listLectures,
  loadSampleLecture,
  startMediaJob,
} from "@/lib/api";
import type {
  CapabilityResponse,
  DemoCheckStatus,
  DemoStatusResponse,
  GenerateResponse,
  LectureSummary,
  LectureTimeline,
  OutputMode,
  ProcessingJob,
} from "@/lib/types";

const modeLabels: Record<OutputMode, string> = {
  structured_notes: "Structured Notes",
  adhd_study_pack: "ADHD Study Pack",
  screen_reader_notes: "Screen Reader Notes",
  exam_prep_pack: "Exam Prep Pack",
  plain_language: "Plain Language",
  notetaker_quality_report: "Quality Report",
  captions_vtt: "WebVTT Captions",
  timeline_json: "Evidence JSON",
  transcript_txt: "Plain Transcript",
};

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [lecture, setLecture] = useState<LectureTimeline | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [selectedMode, setSelectedMode] = useState<OutputMode>("adhd_study_pack");
  const [output, setOutput] = useState<GenerateResponse | null>(null);
  const [recentLectures, setRecentLectures] = useState<LectureSummary[]>([]);
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [processingJob, setProcessingJob] = useState<ProcessingJob | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ocrChunkCount = lecture?.chunks.filter((chunk) => hasReadableOcrEvidence(chunk.ocr)).length ?? 0;
  const averageSourceConfidence = lecture
    ? lecture.chunks.reduce((total, chunk) => total + chunk.source_confidence, 0) / Math.max(1, lecture.chunks.length)
    : 0;
  const coverage = percentNumber(averageSourceConfidence);
  const ocrCoverage = lecture ? Math.round((ocrChunkCount / Math.max(1, lecture.chunks.length)) * 100) : 0;
  const estimatedReviewMinutes = lecture ? Math.max(8, lecture.chunks.length * 4) : 0;

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));
    getCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
    void refreshDemoStatus();
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

  async function refreshDemoStatus() {
    try {
      const status = await getDemoStatus();
      setDemoStatus(status);
    } catch {
      setDemoStatus(null);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setIsBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setApiStatus("ok");
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
      setApiStatus("ok");
      setProcessingJob(activeJob);
      setNotice(`Resumed ${formatJobKind(activeJob.kind)} job at ${activeJob.stage}.`);
      setIsBusy(true);
      try {
        await continueProcessingJob(activeJob);
      } finally {
        setIsBusy(false);
      }
    } catch {
      // Best-effort resume; the health check owns the visible API state.
    }
  }

  async function continueProcessingJob(startJob: ProcessingJob) {
    setProcessingJob(startJob);
    const completedJob = await waitForProcessingJob(startJob.job_id, setProcessingJob);
    if (completedJob.status === "canceled") {
      setNotice(`${formatJobKind(completedJob.kind)} processing canceled.`);
      return;
    }
    if (completedJob.status === "failed") {
      throw new Error(completedJob.error || `${formatJobKind(completedJob.kind)} processing failed.`);
    }
    if (!completedJob.lecture_id) {
      throw new Error(`${formatJobKind(completedJob.kind)} processing finished without a lecture timeline.`);
    }

    const nextLecture = await getLecture(completedJob.lecture_id);
    setLecture(nextLecture);
    setOutput(null);
    await refreshRecentLectures();
    await refreshDemoStatus();
    setNotice(describeCompletedJob(completedJob));
  }

  async function handleCancelProcessingJob(jobId: string) {
    setError(null);
    try {
      const canceledJob = await cancelProcessingJob(jobId);
      setProcessingJob(canceledJob);
      setNotice("Processing canceled.");
      setIsBusy(false);
      await refreshDemoStatus();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not cancel processing.");
    }
  }

  async function handleLoadSample() {
    await runAction(async () => {
      const sample = await loadSampleLecture();
      setLecture(sample);
      setOutput(null);
    });
  }

  async function handleCreateLecture(title: string, transcript: string) {
    await runAction(async () => {
      const created = await createLectureFromTranscript(title, transcript);
      const nextLecture = await getLecture(created.lecture_id);
      setLecture(nextLecture);
      setOutput(null);
      await refreshRecentLectures();
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
    });
  }

  async function handleGenerate() {
    if (!lecture) {
      setError("Load or create a lecture before generating an output.");
      return;
    }

    await runAction(async () => {
      const generated = await generateOutput(lecture.lecture_id, selectedMode);
      setOutput(generated);
    });
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fb] text-zinc-950">
      <Header apiStatus={apiStatus} />

      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faf7_58%,#f7fbff_100%)]">
        <div className="mx-auto grid min-w-0 max-w-[1500px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8 lg:py-12">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Local AI-powered accessibility
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Turn lecture materials into accessible study formats
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Upload permitted recordings, slides, or transcripts and generate source-grounded notes, study packs,
              screen-reader summaries, and review reports on this machine.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-11 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900"
              >
                <a href="#source-desk">
                  Upload source
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
                Load sample lecture
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <HeroBenefit
                icon={<TimerReset className="h-4 w-4" aria-hidden="true" />}
                title="Save review time"
                detail="Jump from raw lecture material to scannable evidence."
              />
              <HeroBenefit
                icon={<Eye className="h-4 w-4" aria-hidden="true" />}
                title="Support access needs"
                detail="Build formats for focus, screen readers, and plain language."
              />
              <HeroBenefit
                icon={<HardDrive className="h-4 w-4" aria-hidden="true" />}
                title="Stay local"
                detail="No account, no cloud database, no Azure pipeline yet."
              />
            </div>
          </div>

          <UploadPanel
            onLoadSample={handleLoadSample}
            onCreateLecture={handleCreateLecture}
            onUploadVideo={handleUploadVideo}
            onUploadImage={handleUploadImage}
            capabilities={capabilities}
            isBusy={isBusy}
            processingJob={processingJob}
            onCancelProcessingJob={handleCancelProcessingJob}
          />
        </div>
      </section>

      <SafetyBanner />

      <section id="workbench" className="mx-auto max-w-[1500px] px-5 py-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">AccessiNote workbench</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
              Review evidence before exporting notes
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip
              icon={<Activity className="h-4 w-4" aria-hidden="true" />}
              label={apiStatus === "ok" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API"}
              tone={apiStatus === "offline" ? "warning" : "success"}
            />
            <StatusChip
              icon={<ScanText className="h-4 w-4" aria-hidden="true" />}
              label={capabilities?.ocr_engines.length ? "OCR ready" : "OCR checking"}
              tone={capabilities?.ocr_engines.length ? "success" : "warning"}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px] xl:items-start">
          <aside className="min-w-0 space-y-5">
            <LectureOverview lecture={lecture} />
            <RecentTimelines lectures={recentLectures} onLoad={handleLoadSavedLecture} disabled={isBusy} />
            <WorkbenchStat
              icon={<UploadCloud className="h-4 w-4" aria-hidden="true" />}
              label="Source"
              value={lecture ? lecture.source.type : "Not loaded"}
              detail={lecture ? lecture.source.attribution || lecture.title : "Choose a source from the upload desk."}
            />
            <WorkbenchStat
              icon={<ScanText className="h-4 w-4" aria-hidden="true" />}
              label="OCR coverage"
              value={lecture ? `${ocrCoverage}%` : "Waiting"}
              detail={lecture ? `${ocrChunkCount} timeline chunk(s) include OCR text.` : "Image and video scans appear here."}
            />
          </aside>

          <div className="min-w-0 space-y-5">
            <ModeSelector selectedMode={selectedMode} onSelectMode={setSelectedMode} disabled={!lecture || isBusy} />

            <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-950">{modeLabels[selectedMode]}</p>
                  <p className="mt-1 text-sm leading-5 text-zinc-600">
                    Generate an accessible export from reviewed timeline evidence.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!lecture || isBusy}
                  className="min-h-11 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 active:translate-y-px active:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                >
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate output
                </Button>
              </div>

              {error && (
                <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                  {error}
                </div>
              )}
              {notice && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
                  {notice}
                </div>
              )}
            </Card>

            <OutputViewer output={output} />
          </div>

          <aside className="min-w-0 space-y-5">
            <DemoReadinessPanel status={demoStatus} />
            <ScanReportPanel lecture={lecture} job={processingJob} />
            <InsightsPanel
              coverage={coverage}
              concepts={lecture ? countConcepts(lecture) : 0}
              timeSaved={estimatedReviewMinutes}
              formats={output ? 1 : 0}
            />
            <PrivacyPanel />
          </aside>
        </div>

        <div className="mt-5">
          <TimelineViewer lecture={lecture} />
        </div>

        <Card className="mt-5 rounded-2xl border-zinc-200 bg-white px-4 py-4 text-center text-sm text-zinc-600 shadow-none">
          Built for accessibility. Designed for learning. Outputs stay reviewable before use.
        </Card>
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

function LectureOverview({ lecture }: { lecture: LectureTimeline | null }) {
  const timelineItems =
    lecture?.chunks.slice(0, 4).map((chunk) => ({
      start: chunk.start,
      title: chunk.concepts[0] ?? chunk.chunk_id,
      detail: chunk.transcript,
    })) ?? [];

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Lecture overview</h2>
        <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50">
          {lecture ? `${lecture.chunks.length} chunks` : "Empty"}
        </Badge>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-50 p-3">
        <p className="text-sm font-semibold text-zinc-950">{lecture ? lecture.title : "No lecture loaded"}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          {lecture ? lecture.source.attribution || lecture.source.type : "Load a sample, paste text, or scan media."}
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
        <h2 className="text-base font-semibold text-zinc-950">Recent local timelines</h2>
        <Badge variant="secondary" className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          {lectures.length}
        </Badge>
      </div>

      {lectures.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Created transcripts and media scans will appear here for this local workspace.
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
                <span>{item.source_type}</span>
                <span>{item.chunk_count} chunks</span>
                <span>{item.ocr_chunk_count} OCR</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function WorkbenchStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
    </Card>
  );
}

function DemoReadinessPanel({ status }: { status: DemoStatusResponse | null }) {
  const checks = status?.checks ?? [];
  const failCount = checks.filter((check) => check.status === "fail").length;
  const warnCount = checks.filter((check) => check.status === "warn").length;
  const passCount = checks.filter((check) => check.status === "pass").length;

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Demo readiness</h2>
        <Badge
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            status?.ready
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100 hover:bg-emerald-50"
              : "bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-50"
          }`}
        >
          {status ? (status.ready ? "Ready" : "Needs review") : "Checking"}
        </Badge>
      </div>

      {status ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            <ReadinessCount label="Pass" value={passCount} tone="pass" />
            <ReadinessCount label="Warn" value={warnCount} tone="warn" />
            <ReadinessCount label="Fail" value={failCount} tone="fail" />
          </div>
          <div className="mt-3 space-y-2">
            {checks.slice(0, 6).map((check) => (
              <div key={check.id} className="rounded-lg bg-zinc-50 px-3 py-2 ring-1 ring-zinc-200">
                <div className="flex items-center gap-2">
                  <ReadinessIcon status={check.status} />
                  <p className="min-w-0 truncate text-sm font-semibold text-zinc-950">{check.label}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-600">{check.detail}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Checking local tools, exports, recent video processing, and optional Microsoft provider configuration.
        </p>
      )}
    </Card>
  );
}

function ReadinessCount({ label, value, tone }: { label: string; value: number; tone: DemoCheckStatus }) {
  const color =
    tone === "pass"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-100"
      : tone === "warn"
        ? "bg-amber-50 text-amber-950 ring-amber-200"
        : "bg-rose-50 text-rose-900 ring-rose-200";
  return (
    <div className={`rounded-lg px-2 py-2 ring-1 ${color}`}>
      <p className="text-base font-semibold">{value}</p>
      <p>{label}</p>
    </div>
  );
}

function ReadinessIcon({ status }: { status: DemoCheckStatus }) {
  if (status === "pass") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />;
  }
  if (status === "warn") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />;
  }
  return <XCircle className="h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />;
}

function ScanReportPanel({ lecture, job }: { lecture: LectureTimeline | null; job: ProcessingJob | null }) {
  const metadata = lecture?.processing_metadata;
  const metrics = metadata?.metrics ?? job?.metrics;
  const stage = job?.status === "running" || job?.status === "queued" ? job.stage : metadata?.stages.at(-1);
  const scanWarnings = scanReviewMessages(lecture, job);

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Scan report</h2>
        <Badge className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900 ring-1 ring-sky-100 hover:bg-sky-50">
          {stage || "Waiting"}
        </Badge>
      </div>

      {metrics ? (
        <div className="mt-4 grid gap-3">
          <ReportMetric label="Candidate frames" value={String(metrics.candidate_frame_count)} />
          <ReportMetric label="Selected frames" value={String(metrics.selected_frame_count)} />
          <ReportMetric label="OCR frames" value={String(metrics.ocr_frame_count)} />
          <ReportMetric label="Transcript segments" value={String(metrics.transcript_segment_count)} />
          <ReportMetric label="Weak chunks" value={String(metrics.weak_chunk_count)} />
          <ReportMetric label="Caption source" value={formatShortEngine(metrics.caption_source)} />
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Upload a permitted video or image to see frame selection, OCR coverage, caption source, and confidence
          diagnostics.
        </p>
      )}

      {scanWarnings.length > 0 && (
        <div className="mt-3 space-y-2">
          {scanWarnings.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <p>{warning}</p>
            </div>
          ))}
        </div>
      )}

      {metadata?.warnings.length ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950">
          {metadata.warnings.slice(0, 2).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="truncate text-right font-semibold text-zinc-950">{value}</span>
    </div>
  );
}

function InsightsPanel({
  coverage,
  concepts,
  timeSaved,
  formats,
}: {
  coverage: number;
  concepts: number;
  timeSaved: number;
  formats: number;
}) {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-zinc-950">Learning insights</h2>
        <Badge variant="secondary" className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
          This lecture
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[128px_minmax(0,1fr)] xl:grid-cols-1">
        <div
          className="mx-auto flex h-28 w-28 items-center justify-center rounded-full p-2"
          style={{ background: `conic-gradient(#2563eb ${coverage}%, #e5e7eb 0)` }}
          aria-label={`${coverage}% source coverage`}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-2xl font-semibold text-zinc-950">{coverage}%</span>
            <span className="text-xs font-medium text-zinc-600">coverage</span>
          </div>
        </div>

        <div className="grid gap-3">
          <InsightMetric label="Key concepts" value={concepts ? String(concepts) : "0"} />
          <InsightMetric label="Review time saved" value={timeSaved ? `${timeSaved} min` : "0 min"} />
          <InsightMetric label="Formats generated" value={String(formats)} />
        </div>
      </div>
    </Card>
  );
}

function PrivacyPanel() {
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
        <ShieldCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
        Privacy and safety
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-700">
        Local MVP processing keeps the workflow explicit. Review generated notes before using them for class or access
        support.
      </p>
      <div className="mt-4 space-y-2 text-sm text-zinc-700">
        <SafetyItem label="No account or cloud database" />
        <SafetyItem label="Permitted materials only" />
        <SafetyItem label="Human review required" />
      </div>
    </Card>
  );
}

function SafetyItem({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
      {label}
    </p>
  );
}

function InsightMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2">
      <p className="text-xs font-medium text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function StatusChip({
  icon,
  label,
  tone,
}: {
  icon: ReactNode;
  label: string;
  tone: "success" | "warning";
}) {
  return (
    <Badge
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${
        tone === "success"
          ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100 hover:bg-emerald-50"
          : "bg-amber-50 text-amber-950 ring-1 ring-amber-200 hover:bg-amber-50"
      }`}
    >
      {icon}
      {label}
    </Badge>
  );
}

function countConcepts(lecture: LectureTimeline): number {
  return new Set(lecture.chunks.flatMap((chunk) => chunk.concepts)).size;
}

function percentNumber(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function formatShortEngine(value: string): string {
  if (!value || value === "none") {
    return "None";
  }
  if (value === "faster-whisper") {
    return "Whisper";
  }
  if (value === "uploaded captions") {
    return "Uploaded";
  }
  return value;
}

function formatJobKind(kind: string): string {
  if (kind === "image") {
    return "Image";
  }
  return "Video";
}

function scanReviewMessages(lecture: LectureTimeline | null, job: ProcessingJob | null): string[] {
  const messages: string[] = [];
  if (job?.status === "failed") {
    messages.push(job.error || "Processing failed before AccessiNote could create a reviewable timeline.");
  }
  if (job?.status === "canceled") {
    messages.push("Processing was canceled. Start a new upload when you are ready to scan again.");
  }
  if (!lecture) {
    return messages;
  }

  const metrics = lecture.processing_metadata.metrics;
  if (lecture.source.type === "video" && lecture.caption_segments.length === 0) {
    messages.push("No caption track is attached. Upload captions or enable local transcription for better alignment.");
  }
  if ((lecture.source.type === "video" || lecture.source.type === "image") && metrics.ocr_frame_count === 0) {
    messages.push("No readable OCR text was found. Review keyframes manually, especially slides or board work.");
  }
  if (metrics.average_source_confidence < 0.65) {
    messages.push("Source confidence is low. Treat generated notes as a draft and verify important details.");
  }
  if (metrics.weak_chunk_count > 0) {
    messages.push(`${metrics.weak_chunk_count} timeline chunk(s) need human review before sharing.`);
  }
  return messages.slice(0, 4);
}

function describeCompletedJob(job: ProcessingJob): string {
  const warningText = job.warnings.length > 0 ? ` ${job.warnings.join(" ")}` : "";
  const metrics = job.metrics;
  if (job.kind === "image") {
    return `Image timeline created with ${metrics.ocr_frame_count} OCR-positive frame(s). Engine: ${metrics.ocr_engine}.${warningText}`;
  }
  return `Video timeline created from ${metrics.candidate_frame_count} candidate timestamp(s), ${metrics.selected_frame_count} selected timestamp(s), ${metrics.extracted_frame_count} extracted frame(s), and ${metrics.transcript_segment_count} transcript segment(s). OCR text found in ${metrics.ocr_frame_count} frame(s). OCR: ${metrics.ocr_engine}. Captions: ${metrics.transcription_engine}.${warningText}`;
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
    title: "Load a lecture",
    detail: "Timeline concepts, transcript chunks, OCR, and visual review notes will appear here.",
  },
  {
    start: "08:45",
    title: "Scan media",
    detail: "Video frames and slide images can produce OCR evidence when local tools are ready.",
  },
  {
    start: "22:10",
    title: "Generate format",
    detail: "Choose notes, study packs, screen-reader notes, exam prep, plain language, or quality reports.",
  },
];
