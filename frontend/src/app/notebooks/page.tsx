"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  BookMarked,
  Plus,
  Search,
  BookOpen,
  ArrowRight,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

interface NotebookItem {
  id: string;
  title: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
}

export default function NotebooksPage() {
  const [notebooks, setNotebooks] = useState<NotebookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<NotebookItem | null>(null);

  const loadNotebooks = async () => {
    try {
      const data = await apiClient.listNotebooks();
      setNotebooks((data as any) || []);
    } catch (err) {
      console.error("Failed to fetch notebooks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotebooks();
  }, []);

  const handleCreateNotebook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiClient.createNotebook({
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
      });
      setNewTitle("");
      setNewDesc("");
      setIsCreateOpen(false);
      loadNotebooks();
    } catch (err) {
      console.error("Failed to create notebook", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await apiClient.deleteNotebook(deleteCandidate.id);
      setNotebooks((prev) => prev.filter((n) => n.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (err) {
      console.error("Failed to delete notebook", err);
    }
  };

  const filteredNotebooks = notebooks.filter((nb) =>
    nb.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans select-none pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-6">
          <div>
            <h1 className="font-serif text-display font-semibold text-ink tracking-tight">
              Research Notebooks
            </h1>
            <p className="text-ui text-ink-secondary mt-1">
              Dedicated 3-panel workspaces for document ingestion, grounded chat, and studio synthesis.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-ui flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Notebook</span>
          </Button>
        </div>

        {/* Filter Bar */}
        {notebooks.length > 2 && (
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter notebooks..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-hairline bg-surface text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
            />
          </div>
        )}

        {/* Loading Skeletons matching final layout */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl border border-hairline bg-surface p-5 space-y-3 animate-pulse"
              >
                <div className="h-4 bg-surface-subtle rounded w-2/3" />
                <div className="h-3 bg-surface-subtle rounded w-full" />
                <div className="h-3 bg-surface-subtle rounded w-4/5" />
              </div>
            ))}
          </div>
        ) : filteredNotebooks.length === 0 ? (
          /* Empty State */
          <div className="max-w-md mx-auto my-16 text-center space-y-4">
            <div className="h-12 w-12 rounded-xl bg-surface-subtle border border-hairline text-ink-muted mx-auto flex items-center justify-center">
              <BookMarked className="h-6 w-6 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif text-title font-semibold text-ink">
                No Research Notebooks
              </h3>
              <p className="text-ui text-ink-secondary leading-relaxed max-w-sm mx-auto">
                Create a notebook to organize documents, grounded chat, and studio synthesis.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-2 text-ui"
            >
              + Create Notebook
            </Button>
          </div>
        ) : (
          /* Notebooks Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotebooks.map((nb) => (
              <Link
                key={nb.id}
                href={`/notebooks/workspace?id=${nb.id}`}
                className="group relative flex flex-col justify-between rounded-xl border border-hairline bg-surface p-5 hover:border-border-strong hover:bg-surface-subtle transition-colors duration-150 cursor-pointer shadow-2xs"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-micro uppercase text-ink-muted">
                      Research Notebook
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteCandidate(nb);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-muted hover:text-destructive hover:bg-destructive-subtle transition-opacity"
                      title="Delete notebook"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <h3 className="text-section font-semibold text-ink truncate leading-tight">
                      {nb.title}
                    </h3>
                    <p className="text-caption text-ink-secondary line-clamp-2 mt-1 leading-relaxed">
                      {nb.description || "Grounded research workspace with multi-source synthesis."}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-4 border-t border-hairline flex items-center justify-between text-micro text-ink-muted">
                  <span className="font-mono">
                    Updated {new Date(nb.updated_at || nb.created_at).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 text-ink font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Modal: Create Notebook */}
        {isCreateOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-md bg-surface border border-hairline rounded-xl p-6 shadow-xl space-y-4 text-ink font-sans">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-section font-semibold text-ink">
                    New Research Notebook
                  </h3>
                  <p className="text-caption text-ink-muted mt-0.5">
                    Organize your documents, chat synthesis, and studio outputs.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-7 w-7 p-0 text-ink-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <form onSubmit={handleCreateNotebook} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-caption font-medium text-ink block">
                    Notebook Title
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Financial Due Diligence or Airline Analytics"
                    className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-caption font-medium text-ink block">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Core scope, research questions, or project objective"
                    className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={isSubmitting || !newTitle.trim()}
                  >
                    {isSubmitting ? "Creating..." : "Create Notebook"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deleteCandidate && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-sm bg-surface border border-hairline rounded-xl p-5 shadow-xl space-y-4 text-ink font-sans">
              <h3 className="text-section font-semibold text-ink">
                Delete Notebook?
              </h3>
              <p className="text-caption text-ink-secondary leading-relaxed">
                Are you sure you want to delete <span className="font-medium text-ink">"{deleteCandidate.title}"</span>? All unattached notes and studio artifacts in this notebook will be permanently removed.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-hairline">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDeleteCandidate(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmDelete}
                >
                  Delete Notebook
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
