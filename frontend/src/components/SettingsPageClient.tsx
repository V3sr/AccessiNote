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
  LockKeyhole,
  Rocket,
  Server,
  ShieldCheck,
  SquareTerminal,
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
import { getCapabilities, getDemoStatus, getHealth, getProductionStatus } from "@/lib/api";
import type {
  CapabilityResponse,
  DemoCheck,
  DemoCheckStatus,
  DemoStatusResponse,
  ProductionStatusResponse,
  ProviderStatus,
} from "@/lib/types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function SettingsPageClient() {
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "offline">("checking");
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [productionStatus, setProductionStatus] = useState<ProductionStatusResponse | null>(null);

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

    try {
      setProductionStatus(await getProductionStatus());
    } catch {
      setProductionStatus(null);
    }
  }

  const providers = capabilities?.providers ?? {};
  const providerStatusText = providerSummary(providers);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#f7f9fb] text-zinc-950">
      <Header />

      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f3faf6_62%,#f7f9fb_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:px-8">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Hosted demo key setup
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Let each demo user connect their own Azure keys
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Use this setup page for a public bring-your-own-key demo. Each browser session can choose Azure Speech,
              Azure AI Vision, and Azure OpenAI, then paste the matching keys without changing other visitors.
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
              <Server className="h-4 w-4 text-sky-700" aria-hidden="true" />
              Runtime status
            </h2>
            <div className="mt-4 grid gap-3">
              <StatusLine
                label="Frontend target"
                value={apiBaseUrl}
                status={apiStatus === "ok" ? "pass" : apiStatus === "offline" ? "fail" : "warn"}
              />
              <StatusLine
                label="Demo readiness"
                value={demoStatus ? (demoStatus.ready ? "Ready" : "Needs review") : "Checking"}
                status={demoStatus?.ready ? "pass" : demoStatus ? "warn" : "warn"}
              />
              <StatusLine
                label="Microsoft IQ routes"
                value={providerStatusText}
                status={providerStatusText.includes("configured") ? "pass" : "warn"}
              />
              <StatusLine
                label="Production readiness"
                value={productionStatus ? (productionStatus.ready ? "Ready" : "Needs config") : "Checking"}
                status={productionStatus?.ready ? "pass" : productionStatus ? "warn" : "warn"}
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1500px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-8">
        <div className="min-w-0 space-y-5">
          <LaunchCommandCenter capabilities={capabilities} productionStatus={productionStatus} />
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
              <ProviderUse label="Azure AI Speech" detail="Captions and transcript segments from uploaded video audio." />
              <ProviderUse label="Azure AI Vision" detail="Readable text from slides, screenshots, and selected frames." />
              <ProviderUse label="Azure OpenAI" detail="Higher-quality accessible notes from grounded evidence." />
            </div>
          </Card>

          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Key handling
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Public BYOK mode scopes pasted values to this browser session on the backend. Backend-owned demo keys
              can still be configured with private environment variables instead.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <SafetyRow label="No Azure keys in frontend code" />
              <SafetyRow label="No secret values returned by the API" />
              <SafetyRow label="Other browser sessions are not changed" />
            </div>
          </Card>

          <Card id="production" className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <FileText className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Production launch shape
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
              <p>
                Deploy the Next.js frontend on Vercel with `NEXT_PUBLIC_API_BASE_URL` pointing to the backend URL.
              </p>
              <p>
                Deploy the FastAPI backend on Azure App Service or Azure Container Apps. For BYOK mode, keep runtime
                provider settings enabled. For backend-owned demo keys, set keys as backend secrets.
              </p>
              <p>
                Add the Vercel domain to `ACCESSINOTE_CORS_ORIGINS` on the backend before recording or sharing the app.
              </p>
            </div>
          </Card>

          <ProductionChecklist status={productionStatus} />
        </aside>
      </section>
    </main>
  );
}

function ProductionChecklist({ status }: { status: ProductionStatusResponse | null }) {
  const checks = status?.checks ?? [];
  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
          <Server className="h-4 w-4 text-sky-700" aria-hidden="true" />
          Production checklist
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
            <ProductionCheckRow key={check.id} check={check} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-zinc-700">
          Checking CORS, Azure providers, backend storage, and fallback tools.
        </p>
      )}
    </Card>
  );
}

function LaunchCommandCenter({
  capabilities,
  productionStatus,
}: {
  capabilities: CapabilityResponse | null;
  productionStatus: ProductionStatusResponse | null;
}) {
  const providers = capabilities?.providers ?? {};
  const microsoftIqReady = ["transcription", "ocr", "generation"].every((kind) => {
    const provider = providers[kind];
    return Boolean(provider?.name.startsWith("azure") && provider.configured);
  });
  const hostedSafetyReady = findProductionCheck(productionStatus, "production_runtime_settings")?.status === "pass";
  const corsReady = findProductionCheck(productionStatus, "production_cors")?.status === "pass";
  const productionReady = Boolean(productionStatus?.ready);

  return (
    <Card className="rounded-2xl border-zinc-200 bg-white p-5 shadow-soft lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-zinc-950">
            <Rocket className="h-5 w-5 text-emerald-700" aria-hidden="true" />
            Launch command center
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">
            Use this page before sharing AccessiNote publicly. It tracks the Microsoft IQ requirement, hosted safety
            lock, public frontend origin, and final submission package.
          </p>
        </div>
        <Badge
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            productionReady
              ? "bg-emerald-50 text-emerald-900 ring-emerald-100 hover:bg-emerald-50"
              : "bg-amber-50 text-amber-950 ring-amber-200 hover:bg-amber-50"
          }`}
        >
          {productionReady ? "Shareable" : "Needs launch config"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <LaunchStep
          icon={<Cloud className="h-4 w-4" aria-hidden="true" />}
          title="Microsoft IQ layer"
          detail="Azure AI Speech, Azure AI Vision, and Azure OpenAI are selected and configured."
          ready={microsoftIqReady}
          fallback="Use the BYOK slots below or backend environment variables to configure Azure routes."
        />
        <LaunchStep
          icon={<LockKeyhole className="h-4 w-4" aria-hidden="true" />}
          title="Hosted key mode"
          detail="This deployment supports either backend-managed keys or browser-session BYOK keys."
          ready={hostedSafetyReady}
          fallback="Check ACCESSINOTE_RUNTIME_PROVIDER_SETTINGS on the backend host."
        />
        <LaunchStep
          icon={<Server className="h-4 w-4" aria-hidden="true" />}
          title="Frontend and backend link"
          detail="The deployed frontend origin is allowed by the Azure-hosted backend CORS policy."
          ready={corsReady}
          fallback="Set ACCESSINOTE_CORS_ORIGINS to the Vercel URL on the backend."
        />
        <LaunchStep
          icon={<ClipboardCheck className="h-4 w-4" aria-hidden="true" />}
          title="Submission package"
          detail="README, architecture, demo script, safety, attribution, production, and Microsoft IQ docs are present."
          ready
          fallback="Add the final public GitHub URL and demo video URL before submission."
        />
      </div>

      <div className="mt-5 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
          <SquareTerminal className="h-4 w-4 text-zinc-700" aria-hidden="true" />
          Final verification command
        </p>
        <code className="mt-2 block overflow-x-auto rounded-md bg-zinc-950 px-3 py-2 text-xs leading-5 text-zinc-50">
          .\scripts\check-hackathon-readiness.ps1 -FrontendUrl https://your-vercel-url -BackendUrl
          https://your-azure-backend
        </code>
      </div>
    </Card>
  );
}

function LaunchStep({
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

function findProductionCheck(status: ProductionStatusResponse | null, id: string): DemoCheck | undefined {
  return status?.checks.find((check) => check.id === id);
}

function ProductionCheckRow({ check }: { check: DemoCheck }) {
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
