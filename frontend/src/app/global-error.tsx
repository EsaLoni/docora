"use client";

import React from "react";
import "./globals.css";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md rounded-lg border border-border-hairline bg-surface p-8 text-center space-y-5 shadow-sm">
          <div className="h-10 w-10 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center mx-auto">
            <AlertCircle className="h-5 w-5" />
          </div>

          <div className="space-y-1.5">
            <h1 className="font-serif text-title font-medium text-ink tracking-tight">
              Application Error
            </h1>
            <p className="text-caption text-ink-secondary leading-relaxed">
              A runtime interface error occurred. Your documents and workspace state remain intact.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-gold text-gold-fg hover:opacity-90 text-ui font-medium transition-opacity shadow-xs cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
