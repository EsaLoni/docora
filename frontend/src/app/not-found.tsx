"use client";

import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-8 text-center space-y-5 shadow-xs">
        <div className="h-12 w-12 rounded-xl bg-surface-subtle border border-hairline text-ink-muted flex items-center justify-center mx-auto">
          <FileQuestion className="h-6 w-6 stroke-[1.5]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="font-serif text-title font-semibold text-ink tracking-tight">
            Document or Page Not Found
          </h1>
          <p className="text-ui text-ink-secondary leading-relaxed">
            The requested research session, document view, or workspace URL does not exist or has been relocated.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href="/notebooks"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gold text-gold-fg hover:bg-gold-hover text-ui font-medium transition-colors shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Notebooks</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
