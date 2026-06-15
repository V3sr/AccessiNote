import { Accessibility, ArrowDown, KeyRound } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Start", href: "/#product" },
  { label: "How it works", href: "/#workflow" },
  { label: "Formats", href: "/#formats" },
  { label: "Review", href: "/#workbench" },
  { label: "Safety", href: "/#safety" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-5 py-3 backdrop-blur lg:px-8">
      <div className="mx-auto flex min-h-14 max-w-[1500px] items-center justify-between gap-4">
        <Link href="/#product" className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white">
            <Accessibility className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold tracking-normal text-zinc-950">AccessiNote</span>
            <span className="block truncate text-xs font-medium text-zinc-600">Accessible study notes</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-semibold text-zinc-700 lg:flex" aria-label="Primary">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className="transition hover:text-zinc-950">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            asChild
            variant="outline"
            className="min-h-10 rounded-md border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 active:translate-y-px active:bg-zinc-100"
          >
            <Link href="/settings">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">API keys</span>
              <span className="sr-only sm:hidden">API keys</span>
            </Link>
          </Button>
          <Button
            asChild
            className="min-h-10 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 active:translate-y-px active:bg-emerald-900"
          >
            <Link href="/#source-desk">
              <span className="hidden sm:inline">Create accessible notes</span>
              <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
