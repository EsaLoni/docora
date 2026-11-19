"use client";

import React, { useEffect } from "react";
import { X, FileText, ExternalLink, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CitationItem } from "@/lib/api-client";

export interface CitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  citation: CitationItem | null;
  citationIndex?: number;
}

export function CitationDrawer({
  isOpen,
  onClose,
  citation,
  citationIndex,
}: CitationDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !citation) return null;

  return (
    <div
      role="dialog"
      aria-label="Citation source preview"
      aria-modal="true"
      className="absolute inset-y-0 right-0 z-30 w-full sm:w-[380px] bg-surface border-l border-hairline shadow-md flex flex-col animate-in slide-in-from-right-4 duration-150"
    >
      {/* Drawer Header */}
      <div className="h-12 px-4 border-b border-hairline flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-micro font-medium px-1.5 py-0.5 rounded bg-verdigris-subtle text-verdigris border border-verdigris">
            [{citationIndex ?? 1}]
          </span>
          <span className="text-ui font-medium text-ink truncate">
            Source Citation
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-ink-muted hover:text-ink"
          aria-label="Close preview (Esc)"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Document Header & Page metadata */}
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded bg-surface-subtle border border-hairline text-ink-secondary shrink-0 mt-0.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-ui font-medium text-ink break-words leading-tight">
                {citation.document_filename || "Document Source"}
              </h4>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="font-mono text-micro text-verdigris bg-verdigris-subtle border border-verdigris rounded px-1.5 py-0.5">
                  Page {citation.page_number || 1}
                </span>
                {citation.relevance_score !== undefined && (
                  <span className="font-mono text-micro text-ink-muted">
                    Score: {Math.round(citation.relevance_score * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Cited Passage Quote */}
        <div className="space-y-1.5">
          <label className="text-micro font-mono uppercase tracking-wider text-ink-muted">
            Cited Passage
          </label>
          <div className="rounded-lg bg-surface-subtle border border-hairline border-l-2 border-l-verdigris p-4">
            <p className="font-serif text-reading leading-relaxed text-ink italic select-text">
              {citation.quote ? (
                `"${citation.quote.trim()}"`
              ) : (
                <span className="not-italic text-ink-muted">
                  Passage reference grounded on page {citation.page_number}.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Chunk & System References */}
        {citation.chunk_id && (
          <div className="pt-2 border-t border-hairline space-y-1">
            <div className="flex items-center justify-between text-micro text-ink-muted">
              <span>Chunk Reference</span>
              <span className="font-mono truncate max-w-[180px]">{citation.chunk_id}</span>
            </div>
            {citation.document_id && (
              <div className="flex items-center justify-between text-micro text-ink-muted">
                <span>Source ID</span>
                <span className="font-mono truncate max-w-[180px]">{citation.document_id}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Footer Actions */}
      <div className="p-3 border-t border-hairline bg-surface-subtle/50 flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="text-ui"
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
