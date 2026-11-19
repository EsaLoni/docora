"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Docora Application Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-surface p-8 text-center space-y-5 shadow-xs">
        <div className="h-12 w-12 rounded-xl bg-destructive-subtle border border-destructive-border text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="h-6 w-6 stroke-[1.5]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="font-serif text-title font-semibold text-ink tracking-tight">
            Unable to Load Workspace View
          </h1>
          <p className="text-ui text-ink-secondary leading-relaxed">
            A rendering error occurred while loading this interface. Your documents, notes, and session data remain securely saved.
          </p>
          {error.message && (
            <div className="p-2.5 rounded bg-surface-subtle border border-hairline text-caption font-mono text-ink-muted text-left mt-2 truncate">
              {error.message}
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center justify-center gap-2.5 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            onClick={() => reset()}
            className="text-ui flex items-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload View</span>
          </Button>

          <Link
            href="/notebooks"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle text-ui text-ink transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Notebooks</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
