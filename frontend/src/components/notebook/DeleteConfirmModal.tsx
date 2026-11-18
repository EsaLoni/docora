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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0E1118] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] p-6 flex flex-col items-center text-center select-none animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-[inset_0_1px_0_0_rgba(244,63,94,0.1)]">
          <Trash2 className="w-5 h-5" />
        </div>

        <h3 className="text-sm font-semibold text-white tracking-tight">Remove Knowledge Source?</h3>
        <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
          Are you sure you want to remove <span className="font-semibold text-neutral-200">"{source.title}"</span> from this notebook? This unlinks the source but preserves the underlying file in your workspace.
        </p>

        <div className="mt-6 flex items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] disabled:opacity-50"
          >
            {isDeleting ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
