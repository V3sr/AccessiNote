"use client";

import {
  CheckCircle2,
  Cloud,
  ExternalLink,
  KeyRound,
  Loader2,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getProviderSettings, updateProviderSettings } from "@/lib/api";
import type { CapabilityResponse, ProviderSettingsRequest, ProviderSettingsResponse, ProviderStatus } from "@/lib/types";

interface ProviderSettingsPanelProps {
  capabilities: CapabilityResponse | null;
  onSaved: () => Promise<void>;
  variant?: "compact" | "full";
}

export function ProviderSettingsPanel({ capabilities, onSaved, variant = "compact" }: ProviderSettingsPanelProps) {
  const [settings, setSettings] = useState<ProviderSettingsResponse | null>(null);
  const [transcriptionProvider, setTranscriptionProvider] = useState("local");
  const [ocrProvider, setOcrProvider] = useState("local");
  const [generationProvider, setGenerationProvider] = useState("local");
  const [speechKey, setSpeechKey] = useState("");
  const [speechRegion, setSpeechRegion] = useState("");
  const [speechLanguage, setSpeechLanguage] = useState("en-US");
  const [visionEndpoint, setVisionEndpoint] = useState("");
  const [visionKey, setVisionKey] = useState("");
  const [openaiEndpoint, setOpenaiEndpoint] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiDeployment, setOpenaiDeployment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isFull = variant === "full";

  useEffect(() => {
    let isMounted = true;
    getProviderSettings()
      .then((nextSettings) => {
        if (!isMounted) {
          return;
        }
        setSettings(nextSettings);
        setTranscriptionProvider(nextSettings.providers.transcription?.name ?? "local");
        setOcrProvider(nextSettings.providers.ocr?.name ?? "local");
        setGenerationProvider(nextSettings.providers.generation?.name ?? "local");
      })
      .catch(() => {
        if (isMounted) {
          setSettings(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: ProviderSettingsRequest = {
        transcription_provider: transcriptionProvider,
        ocr_provider: ocrProvider,
        generation_provider: generationProvider,
      };
      assignIfPresent(payload, "azure_speech_key", speechKey);
      assignIfPresent(payload, "azure_speech_region", speechRegion);
      assignIfPresent(payload, "azure_speech_language", speechLanguage);
      assignIfPresent(payload, "azure_vision_endpoint", visionEndpoint);
      assignIfPresent(payload, "azure_vision_key", visionKey);
      assignIfPresent(payload, "azure_openai_endpoint", openaiEndpoint);
      assignIfPresent(payload, "azure_openai_api_key", openaiKey);
      assignIfPresent(payload, "azure_openai_deployment", openaiDeployment);
      const saved = await updateProviderSettings(payload);
      setSettings(saved);
      setMessage(saved.message);
      clearSecretFields();
      await onSaved();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not save provider settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUseLocalOnly() {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await updateProviderSettings({
        transcription_provider: "local",
        ocr_provider: "local",
        generation_provider: "local",
        clear_existing: true,
      });
      setTranscriptionProvider("local");
      setOcrProvider("local");
      setGenerationProvider("local");
      setSettings(saved);
      setMessage("Runtime provider overrides cleared. AccessiNote is using local providers for this session.");
      clearSecretFields();
      await onSaved();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not clear provider settings.");
    } finally {
      setIsSaving(false);
    }
  }

  const providers = settings?.providers ?? capabilities?.providers ?? {};
  const configuredEnv = settings?.configured_env ?? [];
  const runtimeSettingsEnabled = settings?.runtime_settings_enabled ?? true;
  const selectedAzureCount = [transcriptionProvider, ocrProvider, generationProvider].filter((name) =>
    name.startsWith("azure"),
  ).length;

  const formBody = (
    <form onSubmit={handleSave} className={isFull ? "mt-5 space-y-5" : "mt-3 space-y-4"}>
      <div className={isFull ? "grid gap-3 lg:grid-cols-3" : "grid gap-3"}>
        <ProviderSelect
          label="Speech transcription"
          value={transcriptionProvider}
          onChange={setTranscriptionProvider}
          options={[
            ["local", "Local faster-whisper"],
            ["azure_speech", "Azure Speech"],
          ]}
        />
        <ProviderSelect
          label="OCR"
          value={ocrProvider}
          onChange={setOcrProvider}
          options={[
            ["local", "Local RapidOCR/Tesseract"],
            ["azure_vision", "Azure AI Vision"],
          ]}
        />
        <ProviderSelect
          label="Study output generation"
          value={generationProvider}
          onChange={setGenerationProvider}
          options={[
            ["local", "Local deterministic"],
            ["azure_openai", "Azure OpenAI"],
          ]}
        />
      </div>

      <div className={isFull ? "grid gap-3 xl:grid-cols-3" : "grid gap-3"}>
        <SecretGroup
          title="Azure Speech"
          description="Required for Azure caption generation from uploaded video audio."
        >
          <SecretInput label="Speech key" value={speechKey} onChange={setSpeechKey} />
          <TextInput label="Region" value={speechRegion} onChange={setSpeechRegion} placeholder="eastus" />
          <TextInput label="Language" value={speechLanguage} onChange={setSpeechLanguage} placeholder="en-US" />
        </SecretGroup>

        <SecretGroup
          title="Azure AI Vision"
          description="Required for Azure OCR on uploaded images and selected video frames."
        >
          <TextInput
            label="Vision endpoint"
            value={visionEndpoint}
            onChange={setVisionEndpoint}
            placeholder="https://resource.cognitiveservices.azure.com/"
          />
          <SecretInput label="Vision key" value={visionKey} onChange={setVisionKey} />
        </SecretGroup>

        <SecretGroup
          title="Azure OpenAI"
          description="Required for Azure-generated study outputs from grounded timeline evidence."
        >
          <TextInput
            label="OpenAI endpoint"
            value={openaiEndpoint}
            onChange={setOpenaiEndpoint}
            placeholder="https://resource.openai.azure.com/"
          />
          <SecretInput label="OpenAI key" value={openaiKey} onChange={setOpenaiKey} />
          <TextInput
            label="Deployment"
            value={openaiDeployment}
            onChange={setOpenaiDeployment}
            placeholder="gpt-4.1-mini"
          />
        </SecretGroup>
      </div>

      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-950">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Leave a key field blank to keep the existing session or private `.env` value. Use local-only to clear
          runtime overrides.
        </p>
      </div>

      {message && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-950">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          disabled={isSaving}
          className="min-h-10 flex-1 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px disabled:cursor-not-allowed disabled:bg-emerald-50 disabled:text-emerald-900"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleUseLocalOnly}
          disabled={isSaving}
          className="min-h-10 flex-1 rounded-md border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 active:translate-y-px disabled:cursor-not-allowed"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Use local only
        </Button>
      </div>
    </form>
  );

  return (
    <Card className={isFull ? "rounded-2xl border-zinc-200 bg-white p-5 shadow-soft lg:p-6" : "rounded-2xl border-zinc-200 bg-white p-4 shadow-soft"}>
      <div className={isFull ? "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between" : "flex items-start justify-between gap-3"}>
        <div className="min-w-0">
          <h2 className={isFull ? "flex items-center gap-2 text-xl font-semibold text-zinc-950" : "flex items-center gap-2 text-base font-semibold text-zinc-950"}>
            <KeyRound className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            AI provider keys
          </h2>
          <p className={isFull ? "mt-2 max-w-3xl text-sm leading-6 text-zinc-700" : "mt-1 text-sm leading-6 text-zinc-700"}>
            {runtimeSettingsEnabled
              ? "Add Azure keys for this backend session. Secrets stay server-side, are never shown again, and can be cleared back to local processing."
              : "Azure providers are managed by backend environment secrets on this deployment. Secret values are never returned to the browser."}
          </p>
        </div>
        <Badge className="w-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-100">
          {runtimeSettingsEnabled ? "Session only" : "Backend managed"}
        </Badge>
      </div>

      {isFull && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SetupMetric label="Azure routes selected" value={String(selectedAzureCount)} />
          <SetupMetric label="Configured values" value={String(configuredEnv.length)} />
          <SetupMetric label="Fallback mode" value="Local ready" />
        </div>
      )}

      <div className={isFull ? "mt-4 grid gap-3 sm:grid-cols-3" : "mt-3 grid gap-2"}>
        <ProviderStatusRow label="Speech" status={providers.transcription} />
        <ProviderStatusRow label="OCR" status={providers.ocr} />
        <ProviderStatusRow label="Generation" status={providers.generation} />
      </div>

      {isFull ? (
        <>
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-950">
            <p className="flex items-start gap-2">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {runtimeSettingsEnabled
                ? "Use this page for a live hackathon setup. Do not show real keys in recordings or screenshots."
                : "Runtime edits are disabled for this hosted deployment. Configure Azure providers through backend environment variables."}
            </p>
          </div>
          {runtimeSettingsEnabled ? formBody : <ReadOnlyProviderNotice />}
        </>
      ) : (
        <>
          <Button
            asChild
            variant="outline"
            className="mt-4 min-h-10 w-full rounded-md border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 active:translate-y-px"
          >
            <Link href="/settings">
              Open full setup
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          {runtimeSettingsEnabled ? (
            <details className="group mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
                <span className="flex items-center gap-2 text-sm font-semibold text-zinc-950">
                  <Cloud className="h-4 w-4 text-sky-700" aria-hidden="true" />
                  Quick configure
                </span>
                <span className="text-xs font-semibold text-zinc-600">{configuredEnv.length} value(s)</span>
              </summary>
              {formBody}
            </details>
          ) : (
            <ReadOnlyProviderNotice />
          )}
        </>
      )}
    </Card>
  );

  function clearSecretFields() {
    setSpeechKey("");
    setVisionKey("");
    setOpenaiKey("");
  }
}

function ReadOnlyProviderNotice() {
  return (
    <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
      Provider editing is read-only on this deployment. Update Azure keys and provider switches in the backend host
      environment, then redeploy or restart the backend.
    </div>
  );
}

function SetupMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-3 ring-1 ring-zinc-200">
      <p className="text-xs font-medium text-zinc-600">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function ProviderStatusRow({ label, status }: { label: string; status?: ProviderStatus }) {
  const ready = Boolean(status?.configured);
  const Icon = ready ? CheckCircle2 : XCircle;
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-xs ring-1 ring-zinc-200">
      <span className="font-semibold text-zinc-800">{label}</span>
      <span
        className={`inline-flex max-w-[190px] items-center gap-1 rounded-md px-2 py-1 font-semibold ${
          ready ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-950"
        }`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{status ? providerLabel(status.name, ready) : "Checking"}</span>
      </span>
    </div>
  );
}

function ProviderSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block text-xs font-semibold text-zinc-800">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SecretGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <h3 className="text-xs font-semibold text-zinc-950">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{description}</p>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-medium text-zinc-700">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function SecretInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-xs font-medium text-zinc-700">
      {label}
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste key"
        autoComplete="off"
        className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function assignIfPresent(payload: ProviderSettingsRequest, field: keyof ProviderSettingsRequest, value: string) {
  const cleanValue = value.trim();
  if (cleanValue) {
    (payload as unknown as Record<string, string | boolean | undefined>)[field] = cleanValue;
  }
}

function providerLabel(name: string, configured: boolean): string {
  if (name === "azure_speech") {
    return configured ? "Azure Speech" : "Azure Speech missing keys";
  }
  if (name === "azure_vision") {
    return configured ? "Azure Vision" : "Azure Vision missing keys";
  }
  if (name === "azure_openai") {
    return configured ? "Azure OpenAI" : "Azure OpenAI missing keys";
  }
  return "Local";
}
