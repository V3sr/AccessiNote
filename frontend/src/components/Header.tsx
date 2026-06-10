import { Accessibility, GraduationCap } from "lucide-react";

interface HeaderProps {
  apiStatus: "checking" | "ok" | "offline";
}

export function Header({ apiStatus }: HeaderProps) {
  const statusLabel =
    apiStatus === "ok" ? "API connected" : apiStatus === "offline" ? "API offline" : "Checking API";

  return (
    <header className="flex flex-col gap-4 border-b border-zinc-200 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
          <Accessibility className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">AccessiNote</h1>
            <GraduationCap className="h-5 w-5 text-sky-700" aria-hidden="true" />
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
            Local lecture accessibility workbench for timestamped notes, study packs, screen-reader
            notes, and exam prep.
          </p>
        </div>
      </div>
      <div
        className="inline-flex w-fit items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
        aria-live="polite"
      >
        <span
          className={
            apiStatus === "ok"
              ? "h-2.5 w-2.5 rounded-full bg-emerald-600"
              : apiStatus === "offline"
                ? "h-2.5 w-2.5 rounded-full bg-rose-600"
                : "h-2.5 w-2.5 rounded-full bg-amber-500"
          }
        />
        {statusLabel}
      </div>
    </header>
  );
}
