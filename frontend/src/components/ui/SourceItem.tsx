"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  Globe,
  Video,
  RefreshCw,
  Trash2,
  AlertCircle,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { StatusBadge, StatusType } from "./StatusBadge";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

export interface SourceItemData {
  id: string;
  title: string;
  type?: "pdf" | "web" | "youtube" | "markdown" | "audio" | "document" | "url" | string;
  status: StatusType;
  tokenCount?: number;
  pageCount?: number;
  progressPercent?: number;
  errorMessage?: string;
  isActiveForQueries?: boolean;
}

export interface SourceItemProps {
  source: SourceItemData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onToggleActive?: (id: string, currentStatus: boolean) => void;
  onRename?: (id: string, newTitle: string) => Promise<void> | void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function SourceItem({
  source,
  isSelected,
  onSelect,
  onToggleActive,
  onRename,
  onRetry,
  onDelete,
  className,
}: SourceItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(source.title);
  const [isSavingRename, setIsSavingRename] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditedTitle(source.title);
  }, [source.title]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  const handleSaveRename = async () => {
    const trimmed = editedTitle.trim();
    if (!trimmed || trimmed === source.title) {
      setIsEditing(false);
      setEditedTitle(source.title);
      return;
    }
    setIsSavingRename(true);
    try {
      if (onRename) {
        await onRename(source.id, trimmed);
      }
      setIsEditing(false);
    } catch {
      setEditedTitle(source.title);
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditedTitle(source.title);
    }
  };

  const isFailed = source.status === "failed" || source.status === "error";

  const getSourceIcon = () => {
    switch (source.type?.toLowerCase()) {
      case "youtube":
      case "video":
        return <Video className="w-3.5 h-3.5 text-ink-secondary" />;
      case "web":
      case "url":
        return <Globe className="w-3.5 h-3.5 text-ink-secondary" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-ink-secondary" />;
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(source.id)}
      className={cn(
        "group relative flex flex-col p-3 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 select-none",
        source.isActiveForQueries && "border-border-strong",
        isSelected && "ring-1 ring-border-strong bg-surface-subtle",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Active Checkbox for Chat Scope */}
          {onToggleActive && (
            <label
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 relative flex items-center justify-center cursor-pointer select-none"
              title={
                source.isActiveForQueries
                  ? "Included in chat synthesis (Click to exclude)"
                  : "Excluded from chat synthesis (Click to include)"
              }
            >
              <input
                type="checkbox"
                checked={!!source.isActiveForQueries}
                onChange={() => onToggleActive(source.id, !!source.isActiveForQueries)}
                className="peer sr-only"
                aria-label={`Include ${source.title} in chat scope`}
              />
              <div className="w-4 h-4 rounded border border-hairline bg-surface peer-checked:bg-gold peer-checked:border-gold flex items-center justify-center transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-gold">
                {source.isActiveForQueries && (
                  <Check className="w-3 h-3 text-gold-fg stroke-[2.5]" />
                )}
              </div>
            </label>
          )}

          {/* Source Type Icon */}
          <div className="p-1 rounded bg-surface-subtle border border-hairline shrink-0 mt-0.5">
            {getSourceIcon()}
          </div>

          {/* Title and metadata */}
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5"
              >
                <input
                  ref={editInputRef}
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSavingRename}
                  className="w-full text-ui font-sans text-ink bg-surface border border-border-strong rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-border-strong"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveRename}
                  disabled={isSavingRename}
                  className="h-6 w-6 p-0 text-verdigris hover:text-verdigris"
                  title="Save title (Enter)"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTitle(source.title);
                  }}
                  className="h-6 w-6 p-0 text-ink-muted hover:text-ink"
                  title="Cancel (Esc)"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4
                  className="text-ui font-sans font-medium text-ink truncate leading-tight"
                  title={source.title}
                >
                  {source.title}
                </h4>
                {onRename && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    title="Rename source"
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-ink-muted hover:text-ink transition-opacity duration-150"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Metadata Bar */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-micro font-mono text-ink-muted uppercase">
                {source.type || "Document"}
              </span>
              {typeof source.pageCount === "number" && source.pageCount > 0 && (
                <>
                  <span className="text-ink-muted/40">•</span>
                  <span className="text-micro font-mono text-ink-muted">
                    {source.pageCount} {source.pageCount === 1 ? "page" : "pages"}
                  </span>
                </>
              )}
              {typeof source.tokenCount === "number" && source.tokenCount > 0 && (
                <>
                  <span className="text-ink-muted/40">•</span>
                  <span className="text-micro font-mono text-ink-muted">
                    {source.tokenCount.toLocaleString()} tokens
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status and Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={source.status} />

          {/* Retry Button on Failure */}
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(source.id);
              }}
              title="Retry ingestion"
              className="p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors duration-150"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            </button>
          )}

          {/* Delete Action Button */}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(source.id);
              }}
              title="Remove source from notebook"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-ink-muted hover:text-destructive hover:bg-destructive-subtle transition-opacity duration-150"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Real progress feedback during extraction / indexing */}
      {source.progressPercent !== undefined &&
        source.status !== "ready" &&
        !isFailed && (
          <div className="mt-2.5 w-full">
            <div className="h-1 w-full bg-surface-subtle rounded-full overflow-hidden border border-hairline">
              <div
                className="h-full bg-amber-600 dark:bg-amber-400 transition-all duration-200"
                style={{ width: `${Math.min(100, Math.max(5, source.progressPercent))}%` }}
              />
            </div>
          </div>
        )}

      {/* Failure reason and Retry guidance */}
      {isFailed && (
        <div className="mt-2.5 p-2 rounded bg-destructive-subtle/50 border border-destructive-border flex items-start justify-between gap-2">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-micro font-sans text-destructive break-words leading-tight">
              {source.errorMessage || "Extraction failed. The document or link could not be processed."}
            </span>
          </div>
          {onRetry && (
            <Button
              variant="secondary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRetry(source.id);
              }}
              className="h-5 px-1.5 text-micro font-medium text-destructive hover:text-destructive shrink-0"
            >
              Retry
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
