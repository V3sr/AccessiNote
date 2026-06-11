import { AlertTriangle } from "lucide-react";

export function SafetyBanner() {
  return (
    <section className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 lg:px-8">
      <div className="mx-auto flex min-w-0 max-w-[1500px] items-start gap-3 text-sm leading-6 text-amber-950">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="min-w-0 break-words">
          Use permitted lecture materials only. Do not upload private student data, exams,
          accommodation records, or unauthorized recordings. AI outputs may contain errors and
          require human review.
        </p>
      </div>
    </section>
  );
}
