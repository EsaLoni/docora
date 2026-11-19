"use client";

import React, { useState } from "react";
import {
  Plus,
  Search,
  BookOpen,
  StickyNote,
  Trash2,
  Check,
  Filter,
} from "lucide-react";
import { SourceItem as ApiSourceItem, NoteItem } from "@/lib/api-client";
import { SourceItem, SourceItemData } from "@/components/ui/SourceItem";
import { StatusType } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";

export interface SourcesPanelProps {
  sources: ApiSourceItem[];
  notes: NoteItem[];
  onToggleSource: (id: string, currentStatus: boolean) => Promise<void>;
  onDeleteSource: (source: ApiSourceItem) => void;
  onOpenAddSource: () => void;
  onOpenCreateNote: () => void;
  onDeleteNote: (id: string) => Promise<void>;
  onRenameSource?: (id: string, newTitle: string) => Promise<void> | void;
  onRetrySource?: (source: ApiSourceItem) => Promise<void> | void;
}

export function SourcesPanel({
  sources,
  notes,
  onToggleSource,
  onDeleteSource,
  onOpenAddSource,
  onOpenCreateNote,
  onDeleteNote,
  onRenameSource,
  onRetrySource,
}: SourcesPanelProps) {
  const [activeTab, setActiveTab] = useState<"sources" | "notes">("sources");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSourcesCount = sources.filter((s) => s.is_active_for_queries).length;

  // Toggle all sources active or inactive
  const handleToggleAll = async () => {
    const shouldSelectAll = activeSourcesCount < sources.length;
    for (const source of sources) {
      if (source.is_active_for_queries !== shouldSelectAll) {
        await onToggleSource(source.id, source.is_active_for_queries);
      }
    }
  };

  // Map backend extraction status to the 5 real stages
  const mapExtractionStatus = (status?: string): StatusType => {
    switch (status?.toLowerCase()) {
      case "uploading":
        return "uploading";
      case "extracting":
      case "processing":
        return "extracting";
      case "indexing":
        return "indexing";
      case "failed":
      case "error":
        return "failed";
      case "completed":
      case "ready":
      case "indexed":
      default:
        return "ready";
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-surface text-ink font-sans select-none overflow-hidden">
      {/* Header Tabs & Add Action */}
      <div className="p-3 border-b border-hairline flex items-center justify-between gap-2 shrink-0 bg-surface">
        <div className="flex items-center gap-1 bg-surface-subtle p-0.5 rounded-lg border border-hairline">
          <button
            type="button"
            onClick={() => setActiveTab("sources")}
            className={`px-2.5 py-1 rounded text-caption font-medium transition-colors duration-150 cursor-pointer ${
              activeTab === "sources"
                ? "bg-surface text-ink font-semibold shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Sources ({sources.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={`px-2.5 py-1 rounded text-caption font-medium transition-colors duration-150 cursor-pointer ${
              activeTab === "notes"
                ? "bg-surface text-ink font-semibold shadow-xs"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            Notes ({notes.length})
          </button>
        </div>

        {/* Primary Action Button (Gold for primary action) */}
        {activeTab === "sources" ? (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenAddSource}
            className="flex items-center gap-1 px-2.5 py-1 text-ui font-medium h-7"
            aria-label="Add knowledge source"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenCreateNote}
            className="flex items-center gap-1 px-2.5 py-1 text-ui font-medium h-7"
            aria-label="Create note"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Note</span>
          </Button>
        )}
      </div>

      {/* Scope Status Banner & Select All Toggle */}
      {activeTab === "sources" && sources.length > 0 && (
        <div className="px-3 py-1.5 border-b border-hairline flex items-center justify-between text-micro text-ink-muted bg-surface-subtle/50">
          <span>
            {activeSourcesCount} of {sources.length} active in synthesis
          </span>
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-micro font-mono text-ink-secondary hover:text-ink transition-colors duration-150 cursor-pointer"
          >
            {activeSourcesCount === sources.length ? "Deselect All" : "Select All"}
          </button>
        </div>
      )}

      {/* Search Bar (visible if more than 3 sources) */}
      {activeTab === "sources" && sources.length > 3 && (
        <div className="px-3 pt-2.5 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-ink-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Filter sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-surface border border-hairline text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
            />
          </div>
        </div>
      )}

      {/* Scrollable Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {activeTab === "sources" ? (
          filteredSources.length > 0 ? (
            <>
              {filteredSources.map((source) => {
                const itemData: SourceItemData = {
                  id: source.id,
                  title: source.title,
                  type: source.source_type,
                  status: mapExtractionStatus(source.extraction_status),
                  tokenCount: source.token_count,
                  pageCount: source.metadata?.page_count,
                  progressPercent: source.metadata?.progress_percent,
                  errorMessage: source.metadata?.error_message,
                  isActiveForQueries: source.is_active_for_queries,
                };

                return (
                  <SourceItem
                    key={source.id}
                    source={itemData}
                    onToggleActive={() => onToggleSource(source.id, source.is_active_for_queries)}
                    onRename={
                      onRenameSource
                        ? (id, newTitle) => onRenameSource(id, newTitle)
                        : undefined
                    }
                    onDelete={() => onDeleteSource(source)}
                    onRetry={
                      onRetrySource
                        ? () => onRetrySource(source)
                        : undefined
                    }
                  />
                );
              })}

              {/* Add Another Source Button at bottom of list */}
              <button
                type="button"
                onClick={onOpenAddSource}
                className="w-full py-2 rounded-lg border border-dashed border-hairline hover:border-border-strong bg-surface hover:bg-surface-subtle text-caption font-medium text-ink-secondary hover:text-ink transition-colors duration-150 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another source</span>
              </button>
            </>
          ) : (
            /* Clean Empty State: Exactly one short sentence explaining what to do + Add action */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="p-3 rounded-full bg-surface-subtle border border-hairline text-ink-muted">
                <BookOpen className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-ui font-medium text-ink max-w-[220px] leading-relaxed">
                Upload a document, web page, or video to ground your synthesis in real evidence.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={onOpenAddSource}
                className="mt-1"
              >
                + Add Source
              </Button>
            </div>
          )
        ) : (
          /* Notes Tab */
          notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative p-3 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 space-y-1.5 select-text"
              >
                <div className="flex items-center justify-between">
                  <span className="text-ui font-medium text-ink truncate pr-4">
                    {note.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-muted hover:text-destructive hover:bg-destructive-subtle transition-opacity duration-150 select-none"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-caption font-serif text-ink-secondary line-clamp-3 leading-relaxed whitespace-pre-wrap">
                  {note.content}
                </p>
                {note.source_citations && note.source_citations.length > 0 && (
                  <div className="pt-1 flex items-center gap-1 text-micro font-mono text-verdigris">
                    <span>Cites {note.source_citations.length} {note.source_citations.length === 1 ? "source" : "sources"}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            /* Notes Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="p-3 rounded-full bg-surface-subtle border border-hairline text-ink-muted">
                <StickyNote className="w-6 h-6 stroke-[1.5]" />
              </div>
              <p className="text-ui font-medium text-ink max-w-[220px] leading-relaxed">
                Save key synthesis insights and personal research notes directly in this notebook.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenCreateNote}
                className="mt-1"
              >
                + Create Note
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
