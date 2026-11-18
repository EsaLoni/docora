"use client";

import React, { useState } from "react";
import { Trash2 } from "lucide-react";
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-black/[0.08] bg-white shadow-2xl p-6 flex flex-col items-center text-center select-none animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
          <Trash2 className="w-5 h-5" />
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">Remove Knowledge Source?</h3>
        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
          Are you sure you want to remove <span className="font-semibold text-neutral-800">"{source.title}"</span> from this notebook? This unlinks the source but preserves the underlying file in your workspace.
        </p>

        <div className="mt-6 flex items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-black/[0.08] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] transition-all shadow-xs disabled:opacity-50"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
