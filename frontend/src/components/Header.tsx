import { Accessibility, GraduationCap } from "lucide-react";

interface HeaderProps {
  apiStatus: "checking" | "ok" | "offline";
}

export function Header({ apiStatus }: HeaderProps) {
  const statusLabel =
    apiStatus === "ok" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API";

  return (
    <header className="flex flex-col gap-4 border-b border-zinc-800 bg-zinc-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-soft">
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-white">AccessiNote</h1>
            <GraduationCap className="h-5 w-5 text-sky-300" aria-hidden="true" />
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-300">
            Local lecture accessibility workbench for timestamped notes, study packs, screen-reader
            notes, and exam prep.
          </p>
        </div>
      </div>
      <div
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-emerald-800 bg-emerald-950 px-3 py-2 text-sm font-medium text-emerald-50"
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
    </header>
  );
}
