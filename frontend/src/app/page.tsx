"use client";

import {
  Activity,
  ArrowDown,
  AlertTriangle,
  BrainCircuit,
  Captions,
  CheckCircle2,
  Cloud,
  Eye,
  FileCheck2,
  GraduationCap,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  Rocket,
  ScanText,
  Server,
  ShieldCheck,
  Sparkles,
  TimerReset,
  UploadCloud,
  UsersRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { ModeSelector } from "@/components/ModeSelector";
import { OutputViewer } from "@/components/OutputViewer";
import { ProviderSettingsPanel } from "@/components/ProviderSettingsPanel";
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
  getProductionStatus,
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
  ProductionStatusResponse,
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
  const [productionStatus, setProductionStatus] = useState<ProductionStatusResponse | null>(null);
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
    void refreshProductionStatus();
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

  async function refreshCapabilities() {
    try {
      const nextCapabilities = await getCapabilities();
      setCapabilities(nextCapabilities);
    } catch {
      setCapabilities(null);
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

  async function refreshProductionStatus() {
    try {
      const status = await getProductionStatus();
      setProductionStatus(status);
    } catch {
      setProductionStatus(null);
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

      <section id="product" className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faf7_58%,#f7fbff_100%)]">
        <div className="mx-auto grid min-w-0 max-w-[1500px] gap-8 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:px-8 lg:py-12">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-50">
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
              Microsoft IQ intelligence layer
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Turn lecture materials into accessible study systems
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Upload permitted recordings, slides, or transcripts and generate source-grounded notes, captions,
              screen-reader summaries, and review reports with Azure AI providers or local fallback.
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
                icon={<Cloud className="h-4 w-4" aria-hidden="true" />}
                title="Microsoft IQ ready"
                detail="Use Azure Speech, Vision, and OpenAI with local fallback."
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
      <MicrosoftIqStrip capabilities={capabilities} productionStatus={productionStatus} />
      <WorkflowSection />
      <UseCasesSection />

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
            <ProviderSettingsPanel
              capabilities={capabilities}
              onSaved={async () => {
                await refreshCapabilities();
                await refreshDemoStatus();
                await refreshProductionStatus();
              }}
            />
            <ProductionStatusPanel status={productionStatus} />
            <div id="demo">
              <DemoReadinessPanel status={demoStatus} />
            </div>
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

function WorkflowSection() {
  const steps = [
    {
      title: "Ingest permitted material",
      detail: "Upload video, slide images, transcripts, captions, or load a saved local timeline.",
    },
    {
      title: "Extract multimodal evidence",
      detail: "Transcribe audio, select keyframes, run OCR, and preserve caption timing.",
    },
    {
      title: "Review source coverage",
      detail: "Check timestamps, visual evidence, warnings, confidence, and weak chunks before export.",
    },
    {
      title: "Generate accessible outputs",
      detail: "Create ADHD study packs, screen-reader notes, captions, exam prep, and evidence JSON.",
    },
  ];

  return (
    <section id="workflow" className="border-b border-zinc-200 bg-white">
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-800">Production workflow</p>
            <h2 className="mt-1 max-w-3xl text-2xl font-semibold tracking-normal text-zinc-950">
              A full review path from upload to accessible export
            </h2>
          </div>
          <Button
            asChild
            variant="outline"
            className="min-h-10 w-fit rounded-md border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
          >
            <Link href="/settings">
              Configure production keys
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

function MicrosoftIqStrip({
  capabilities,
  productionStatus,
}: {
  capabilities: CapabilityResponse | null;
  productionStatus: ProductionStatusResponse | null;
}) {
  const providers = capabilities?.providers ?? {};
  const selectedAzureProviders = Object.values(providers).filter((provider) => provider.name.startsWith("azure"));
  const configuredAzureProviders = selectedAzureProviders.filter((provider) => provider.configured);
  const productionLabel = productionStatus ? (productionStatus.ready ? "Production ready" : "Production checks") : "Checking";

  return (
    <section id="microsoft-iq" className="border-b border-zinc-200 bg-zinc-950 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center lg:px-8">
        <div className="min-w-0">
          <Badge className="inline-flex min-h-9 gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/10">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            Required Microsoft IQ integration
          </Badge>
          <h2 className="mt-4 max-w-2xl text-2xl font-semibold tracking-normal text-white">
            Azure intelligence is part of the lecture pipeline, not a hidden add-on.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300">
            AccessiNote can route transcription, OCR, and grounded generation through Microsoft services while keeping
            local fallback available for a stable demo.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <IqModule
            icon={<Captions className="h-4 w-4" aria-hidden="true" />}
            title="Azure Speech"
            detail="Caption generation and timed transcript segments."
            status={providerState(providers.transcription)}
          />
          <IqModule
            icon={<ScanText className="h-4 w-4" aria-hidden="true" />}
            title="Azure AI Vision"
            detail="OCR from slides, screenshots, and selected frames."
            status={providerState(providers.ocr)}
          />
          <IqModule
            icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            title="Azure OpenAI"
            detail="Accessible notes generated from source evidence."
            status={providerState(providers.generation)}
          />
          <IqModule
            icon={<Server className="h-4 w-4" aria-hidden="true" />}
            title={productionLabel}
            detail={`${configuredAzureProviders.length}/${Math.max(3, selectedAzureProviders.length || 3)} Azure routes configured.`}
            status={productionStatus?.ready ? "Ready" : "Review"}
          />
        </div>
      </div>
    </section>
  );
}

function IqModule({
  icon,
  title,
  detail,
  status,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  status: string;
}) {
  const isReady = status === "Configured" || status === "Ready";
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-emerald-200">
          {icon}
        </span>
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            isReady ? "bg-emerald-300/15 text-emerald-100" : "bg-amber-300/15 text-amber-100"
          }`}
        >
          {status}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-300">{detail}</p>
    </div>
  );
}

function providerState(provider: CapabilityResponse["providers"][string] | undefined): string {
  if (!provider) {
    return "Checking";
  }
  if (provider.name === "local") {
    return "Local";
  }
  return provider.configured ? "Configured" : "Needs keys";
}

function UseCasesSection() {
  return (
    <section id="use-cases" className="border-b border-zinc-200 bg-[#f7f9fb]">
      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-800">Use cases</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">
            A review system for people who need lecture material to be usable.
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-700">
            The app is built around evidence, accessible exports, and human review so it works for real study and
            support workflows instead of producing one generic summary.
          </p>
          <Button
            asChild
            variant="outline"
            className="mt-5 min-h-10 rounded-md border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
          >
            <Link href="/settings">
              Open provider setup
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <UseCaseCard
            icon={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
            title="Students catching up"
            detail="Convert a missed or confusing lecture into a short path, timestamps, captions, and plain-language checkpoints."
            accent="emerald"
          />
          <UseCaseCard
            icon={<UsersRound className="h-4 w-4" aria-hidden="true" />}
            title="Accessibility support teams"
            detail="Inspect weak chunks, OCR coverage, caption source, and review warnings before sharing learning materials."
            accent="sky"
          />
          <UseCaseCard
            icon={<Layers3 className="h-4 w-4" aria-hidden="true" />}
            title="Educators preparing resources"
            detail="Generate structured notes, exam prep, and screen-reader notes while keeping source evidence close."
            accent="zinc"
          />
          <UseCaseCard
            icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
            title="Hosted hackathon demo"
            detail="Run the frontend publicly, keep Azure keys on the backend, and show readiness checks without exposing secrets."
            accent="emerald"
          />
        </div>
      </div>
    </section>
  );
}

function UseCaseCard({
  icon,
  title,
  detail,
  accent,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  accent: "emerald" | "sky" | "zinc";
}) {
  const color =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
      : accent === "sky"
        ? "bg-sky-50 text-sky-800 ring-sky-100"
        : "bg-zinc-100 text-zinc-800 ring-zinc-200";

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-none">
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ring-1 ${color}`}>{icon}</span>
      <h3 className="mt-4 text-base font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-700">{detail}</p>
    </Card>
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

function ProductionStatusPanel({ status }: { status: ProductionStatusResponse | null }) {
  const checks = status?.checks ?? [];
  const blockingChecks = checks.filter((check) => check.status === "fail");
  const warningChecks = checks.filter((check) => check.status === "warn");
  const topChecks = [...blockingChecks, ...warningChecks, ...checks.filter((check) => check.status === "pass")].slice(0, 4);

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <Rocket className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          Production launch
        </h2>
        <Badge
          className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            status?.ready
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100 hover:bg-emerald-50"
              : "bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-50"
          }`}
        >
          {status ? (status.ready ? "Ready" : "Configure") : "Checking"}
        </Badge>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-700">
        Public demos should run the frontend on Vercel, the media backend on Azure, and keep Microsoft IQ keys
        server-side.
      </p>

      {topChecks.length > 0 ? (
        <div className="mt-3 space-y-2">
          {topChecks.map((check) => (
            <div key={check.id} className="flex items-start gap-2 rounded-lg bg-zinc-50 p-2 ring-1 ring-zinc-200">
              <ReadinessIcon status={check.status} />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-zinc-950">{check.label}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-600">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-zinc-700">
          <SafetyItem label="Vercel frontend points at backend" />
          <SafetyItem label="Azure provider secrets stay server-side" />
          <SafetyItem label="Runtime key edits disabled for public visitors" />
        </div>
      )}

      <Button
        asChild
        variant="outline"
        className="mt-3 min-h-10 w-full rounded-md border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
      >
        <Link href="/settings#production">
          Review deployment checks
          <Server className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
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
        AccessiNote keeps processing choices explicit. Review generated notes before using them for class or access
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
