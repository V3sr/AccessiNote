import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

export function SafetyBanner() {
  return (
    <section id="safety" className="border-b border-amber-100 bg-white px-5 py-3 lg:px-8">
      <Alert role="note" className="mx-auto flex min-w-0 max-w-[1500px] items-start gap-3 rounded-xl border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        <span className="mt-0.5 shrink-0 text-amber-700">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </span>
        <AlertDescription className="min-w-0 break-words pl-0 text-sm leading-6 text-amber-950">
          Use only lecture material you are allowed to use. Do not upload private student data, exams,
          accommodation records or recordings you do not have permission for. Check every set of notes for
          mistakes before you use it.
        </AlertDescription>
      </Alert>
    </section>
  );
}
