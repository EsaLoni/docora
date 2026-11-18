"use client";

import React, { useState } from "react";
import { X, StickyNote } from "lucide-react";

interface CreateNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNote: (title: string, content: string) => Promise<void>;
}

export function CreateNoteModal({ isOpen, onClose, onCreateNote }: CreateNoteModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !title.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateNote(title, content);
      setTitle("");
      setContent("");
      onClose();
    } catch {
      // Handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0E1118] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col select-none animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-[#0A0C12]">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">New Notebook Note</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#0E1118]">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
              Title
            </label>
            <input
              type="text"
              placeholder="Note title (e.g. Synthesis & Key Takeaways)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
              Content
            </label>
            <textarea
              required
              rows={6}
              placeholder="Write your research note, synthesis, or thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
