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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white shadow-2xl overflow-hidden flex flex-col select-none animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-black/[0.08] bg-[#F4F5F7]">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">New Notebook Note</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-white">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5 block">
              Title
            </label>
            <input
              type="text"
              placeholder="Note title (e.g. Synthesis & Key Takeaways)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F4F5F7] text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5 block">
              Content
            </label>
            <textarea
              required
              rows={6}
              placeholder="Write your research note, synthesis, or thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F4F5F7] text-xs text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-black/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-black/[0.08] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E5A93B] text-neutral-950 hover:bg-[#D97706] active:scale-[0.98] transition-all shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
