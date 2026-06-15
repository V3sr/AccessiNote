"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Cloud,
  ExternalLink,
  FileText,
  KeyRound,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
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
      <Header apiStatus={apiStatus} />

      <section className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f3faf6_62%,#f7f9fb_100%)]">
        <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:px-8">
          <div className="min-w-0">
            <Badge className="inline-flex min-h-10 gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Production provider setup
            </Badge>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-tight tracking-normal text-zinc-950 lg:text-5xl">
              Connect AccessiNote to your Azure AI services
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-700 lg:text-lg">
              Use server-side Azure keys for the public demo. Local and bring-your-own-key demo modes can still accept
              session keys without exposing secrets in the browser.
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
                <a href="#production">
                  Deployment shape
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
                label="Azure providers"
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
        <ProviderSettingsPanel capabilities={capabilities} onSaved={refreshAll} variant="full" />

        <aside className="space-y-5">
          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <Cloud className="h-4 w-4 text-sky-700" aria-hidden="true" />
              What Azure powers
            </h2>
            <div className="mt-4 space-y-3">
              <ProviderUse label="Speech" detail="Captions and transcript segments from uploaded video audio." />
              <ProviderUse label="Vision OCR" detail="Readable text from slides, screenshots, and selected frames." />
              <ProviderUse label="OpenAI" detail="Higher-quality accessible notes from grounded evidence." />
            </div>
          </Card>

          <Card className="rounded-2xl border-zinc-200 bg-white p-4 shadow-soft">
            <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-950">
              <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Safe key handling
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Production keys belong in backend environment variables. Public deployments should disable runtime
              provider edits after Azure is configured.
            </p>
            <div className="mt-4 space-y-2 text-sm text-zinc-700">
              <SafetyRow label="No Azure keys in frontend code" />
              <SafetyRow label="No secret values returned by the API" />
              <SafetyRow label="Local fallback remains available" />
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
                Deploy the FastAPI backend on Azure App Service or Azure Container Apps with Azure keys set as backend
                secrets.
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
