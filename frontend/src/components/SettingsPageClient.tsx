"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  ClipboardCheck,
  ExternalLink,
  FileText,
  KeyRound,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Header } from "@/components/Header";
import { ProviderSettingsPanel } from "@/components/ProviderSettingsPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCapabilities, getDemoStatus, getHealth } from "@/lib/api";
import type { CapabilityResponse, DemoCheck, DemoCheckStatus, DemoStatusResponse, ProviderStatus } from "@/lib/types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function SettingsPageClient() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);

  useEffect(() => {
    void refreshAll();
  }, []);

  async function refreshAll() {
    try {
      await getHealth();
      setApiStatus("ok");
    } catch {
      setApiStatus("offline");
    }

    try {
      setCapabilities(await getCapabilities());
    } catch {
      setCapabilities(null);
    }

    try {
      setDemoStatus(await getDemoStatus());
    } catch {
      setDemoStatus(null);
    }
  }

  const providers = capabilities?.providers ?? {};
  const providerStatusText = providerSummary(providers);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fb] text-zinc-950">
      <Header />

      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4faf7_62%,#f7f9fb_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:px-8">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Local key setup
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Bring your own keys for local processing
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Use this page when you want AccessiNote to call your own transcription, OCR, or generation
              providers. The values stay scoped to this browser session on the backend, and you can switch back
              to local-only at any time.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                className="min-h-11 rounded-md bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px"
              >
                <Link href="/#workbench">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to workspace
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="min-h-11 rounded-md border-zinc-300 bg-white px-5 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px"
              >
                <a href="#key-setup">
                  Key setup slots
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>

          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <Cloud className="h-4 w-4 text-sky-700" aria-hidden="true" />
              Local status
            </h2>
            <div className="mt-4 grid gap-3">
              <StatusLine
                label="Backend target"
                value={apiBaseUrl}
                status={apiStatus === "ok" ? "pass" : apiStatus === "offline" ? "fail" : "warn"}
              />
              <StatusLine
                label="Demo readiness"
                value={demoStatus ? (demoStatus.ready ? "Ready" : "Needs review") : "Checking"}
                status={demoStatus?.ready ? "pass" : demoStatus ? "warn" : "warn"}
              />
              <StatusLine
                label="Optional keys"
                value={providerStatusText}
                status={providerStatusText.includes("configured") ? "pass" : "warn"}
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-8">
        <div className="min-w-0 space-y-5">
          <LocalWorkflowCard capabilities={capabilities} demoStatus={demoStatus} />
          <div id="key-setup">
            <ProviderSettingsPanel capabilities={capabilities} onSaved={refreshAll} variant="full" />
          </div>
        </div>

        <aside className="space-y-5">
          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <Cloud className="h-4 w-4 text-sky-700" aria-hidden="true" />
              What the keys enable
            </h2>
            <div className="mt-4 space-y-3">
              <ProviderUse label="Speech transcription" detail="Captions and transcript segments from uploaded video audio." />
              <ProviderUse label="OCR" detail="Readable text from slides, screenshots, and selected frames." />
              <ProviderUse label="Output generation" detail="Higher-quality accessible notes from grounded evidence." />
            </div>
          </Card>

          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Key handling
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Keys are scoped to the current browser session on the backend. The API never returns secret
              values, and you can clear everything back to local-only mode at any time.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <SafetyRow label="No keys in frontend code" />
              <SafetyRow label="No secret values returned by the API" />
              <SafetyRow label="Other browser sessions are not changed" />
            </div>
          </Card>

          <DemoChecklist status={demoStatus} />
        </aside>
      </section>
    </main>
  );
}

function DemoChecklist({ status }: { status: DemoStatusResponse | null }) {
  const checks = status?.checks ?? [];
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <ClipboardCheck className="h-4 w-4 text-sky-700" aria-hidden="true" />
          Demo readiness
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

      {checks.length > 0 ? (
        <div className="mt-4 space-y-2">
          {checks.map((check) => (
            <DemoCheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Checking sample data, local tools, exports, recent jobs, and optional provider configuration.
        </p>
      )}
    </Card>
  );
}

function LocalWorkflowCard({
  capabilities,
  demoStatus,
}: {
  capabilities: CapabilityResponse | null;
  demoStatus: DemoStatusResponse | null;
}) {
  const providers = capabilities?.providers ?? {};
  const azureConfigured = ["transcription", "ocr", "generation"].some((kind) => {
    const provider = providers[kind];
    return Boolean(provider?.name.startsWith("azure") && provider.configured);
  });

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-5 shadow-soft lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950">
            <FileText className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Local workflow
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">
            Use this page before a local recording or when you want to plug in your own keys. AccessiNote
            still works without API keys, and optional Azure routes can be switched on only when you want
            them.
          </p>
        </div>
        <Badge
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            demoStatus?.ready
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100 hover:bg-emerald-50"
              : "bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-50"
          }`}
        >
          {demoStatus?.ready ? "Local-ready" : "Needs review"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <LocalStep
          icon={<Cloud className="h-4 w-4" aria-hidden="true" />}
          title="Optional keys"
          detail="Paste your own transcription, OCR, or generation keys when you want cloud-backed processing."
          ready={azureConfigured}
          fallback="You can stay local-only and still load samples, upload material, and export output."
        />
        <LocalStep
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
          title="Review first"
          detail="Keep timestamps, OCR, warnings, and source coverage visible before export."
          ready={Boolean(demoStatus?.ready)}
          fallback="Run the demo readiness checks so missing tools show up before you record."
        />
        <LocalStep
          icon={<FileText className="h-4 w-4" aria-hidden="true" />}
          title="Accessible outputs"
          detail="Generate study packs, screen-reader notes, plain-language output, captions, and evidence JSON."
          ready
          fallback="Accessible outputs stay grounded in the lecture timeline."
        />
        <LocalStep
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          title="Export pack"
          detail="Copy or download markdown, WebVTT, JSON, or transcript output from the generated draft."
          ready
          fallback="Exports stay close to the output panel so they are easy to find."
        />
      </div>

      <div className="mt-5 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <XCircle className="h-4 w-4 text-zinc-700" aria-hidden="true" />
          Final verification command
        </p>
        <code className="mt-2 block overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 text-xs leading-5 text-zinc-50">
          .\scripts\check-hackathon-readiness.ps1 -FrontendUrl http://localhost:3000 -BackendUrl http://localhost:8000
        </code>
      </div>
    </Card>
  );
}

function LocalStep({
  icon,
  title,
  detail,
  ready,
  fallback,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  ready: boolean;
  fallback: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-emerald-700 ring-1 ring-zinc-200">
          {icon}
        </span>
        <Badge
          className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${
            ready
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100 hover:bg-emerald-50"
              : "bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-50"
          }`}
        >
          {ready ? "Ready" : "Action"}
        </Badge>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-zinc-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-700">{ready ? detail : fallback}</p>
    </div>
  );
}

function providerSummary(providers: Record<string, ProviderStatus>): string {
  const configured = Object.values(providers).filter((provider) => provider.name !== "local" && provider.configured);
  if (configured.length > 0) {
    return `${configured.length} configured`;
  }
  const selected = Object.values(providers).filter((provider) => provider.name !== "local");
  if (selected.length > 0) {
    return `${selected.length} selected`;
  }
  return "Local fallback";
}

function DemoCheckRow({ check }: { check: DemoCheck }) {
  const Icon = check.status === "pass" ? CheckCircle2 : check.status === "fail" ? XCircle : AlertTriangle;
  const tone =
    check.status === "pass"
      ? "text-emerald-800"
      : check.status === "fail"
        ? "text-rose-800"
        : "text-amber-800";

  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden="true" />
        <p className="min-w-0 truncate text-sm font-semibold text-zinc-950">{check.label}</p>
      </div>
      <p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-600">{check.detail}</p>
    </div>
  );
}

function ProviderUse({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <p className="text-sm font-semibold text-zinc-950">{label}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
    </div>
  );
}

function SafetyRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
      {label}
    </p>
  );
}

function StatusLine({ label, value, status }: { label: string; value: string; status: DemoCheckStatus }) {
  const Icon = status === "pass" ? CheckCircle2 : status === "fail" ? XCircle : AlertTriangle;
  const tone =
    status === "pass"
      ? "text-emerald-800"
      : status === "fail"
        ? "text-rose-800"
        : "text-amber-800";

  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
      <span className="text-sm font-semibold text-zinc-800">{label}</span>
      <span className={`flex min-w-0 items-center gap-2 text-right text-sm font-semibold ${tone}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{value}</span>
      </span>
    </div>
  );
}
