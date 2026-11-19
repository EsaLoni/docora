"use client";

import React, { useState, useEffect, useRef } from "react";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { SourceItem } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

export interface DeleteConfirmModalProps {
  source: SourceItem | null;
  onClose: () => void;
  onConfirm: (sourceId: string) => Promise<void>;
}

export function DeleteConfirmModal({
  source,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (source) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const cancelBtn = modalRef.current?.querySelector<HTMLButtonElement>("button");
        cancelBtn?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus();
      }
    }
  }, [source]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && source) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [source, onClose]);

  if (!source) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(source.id);
      onClose();
    } catch {
      // Handled by parent
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-source-title"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-sm rounded-xl border border-hairline bg-surface shadow-xl p-5 flex flex-col text-ink font-sans select-none animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="p-2 rounded-lg bg-destructive-subtle text-destructive border border-destructive-border shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-ink-muted hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <h3 id="delete-source-title" className="text-section font-semibold text-ink tracking-tight">
          Remove Knowledge Source?
        </h3>
        <p className="text-caption text-ink-secondary mt-1.5 leading-relaxed">
          Are you sure you want to remove <span className="font-medium text-ink">"{source.title}"</span> from this notebook? This unlinks the source but preserves the underlying file in your workspace.
        </p>

        <div className="mt-5 flex items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-ui"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="text-ui"
          >
            {isDeleting ? "Removing..." : "Remove Source"}
          </Button>
        </div>
      </div>
    </div>
  );
}
