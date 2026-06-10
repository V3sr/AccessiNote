import { AlertTriangle } from "lucide-react";

export function SafetyBanner() {
  return (
    <section className="border-b border-amber-200 bg-amber-50 px-5 py-3 lg:px-8">
      <div className="flex max-w-7xl items-start gap-3 text-sm leading-6 text-amber-950">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <p>
          Use permitted lecture materials only. Do not upload private student data, exams,
          accommodation records, or unauthorized recordings. AI outputs may contain errors and
          require human review.
        </p>
      </div>
    </section>
  );
}

