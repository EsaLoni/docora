"use client";

import React, { useState } from "react";
import { AlertCircle, Trash2 } from "lucide-react";
import { SourceItem } from "@/lib/api-client";

interface DeleteConfirmModalProps {
  source: SourceItem | null;
  onClose: () => void;
  onConfirm: (sourceId: string) => Promise<void>;
}

export function DeleteConfirmModal({ source, onClose, onConfirm }: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--border-subtle)] bg-[var(--panel)] shadow-2xl p-5 flex flex-col items-center text-center animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-500 mb-3">
          <Trash2 className="w-6 h-6" />
        </div>

        <h3 className="text-sm font-bold text-[var(--text-primary)]">Remove Source?</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
          Are you sure you want to remove <span className="font-semibold">"{source.title}"</span> from this notebook? This unlinks the source but does not delete original files.
        </p>

        <div className="mt-5 flex items-center gap-2 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--tile-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
