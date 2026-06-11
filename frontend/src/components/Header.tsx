import { Accessibility, HardDrive, ShieldCheck } from "lucide-react";

interface HeaderProps {
  apiStatus: "checking" | "ok" | "offline";
}

export function Header({ apiStatus }: HeaderProps) {
  const statusLabel =
    apiStatus === "ok" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API";

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-5 py-4 text-white lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-emerald-950">
            <Accessibility className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-normal text-white">AccessiNote</h1>
              <span className="rounded-md border border-zinc-700 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                Local MVP
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-300">
              Evidence-first lecture notes from transcripts, slides, and permitted recordings.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-medium text-zinc-200">
            <HardDrive className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Local processing
          </span>
          <span className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 font-medium text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            Review required
          </span>
          <div
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950 px-3 py-2 font-semibold text-emerald-50"
            aria-live="polite"
          >
            <span
              className={
                apiStatus === "ok"
                  ? "h-2.5 w-2.5 rounded-full bg-emerald-400"
                  : apiStatus === "offline"
                    ? "h-2.5 w-2.5 rounded-full bg-rose-400"
                    : "h-2.5 w-2.5 rounded-full bg-amber-500"
              }
            />
            {statusLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
