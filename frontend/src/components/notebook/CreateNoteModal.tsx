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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--panel)] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">New Notebook Note</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--tile-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
              Title
            </label>
            <input
              type="text"
              placeholder="Note title (e.g. Key Takeaways)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--tile)] text-xs text-[var(--text-primary)] outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
              Content
            </label>
            <textarea
              required
              rows={6}
              placeholder="Write your note, synthesis, or thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--tile)] text-xs text-[var(--text-primary)] outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--tile-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[var(--accent-blue)] text-white hover:opacity-90 shadow-xs"
            >
              {isSubmitting ? "Saving..." : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
