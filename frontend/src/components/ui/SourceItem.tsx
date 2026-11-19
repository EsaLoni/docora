"use client";

import React from "react";
import { FileText, Globe, Video, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { StatusBadge, StatusType } from "./StatusBadge";
import { cn } from "@/lib/utils";

export interface SourceItemData {
  id: string;
  title: string;
  type?: "pdf" | "web" | "youtube" | "markdown" | "audio" | string;
  status: StatusType;
  tokenCount?: number;
  progressPercent?: number;
  errorMessage?: string;
}

export interface SourceItemProps {
  source: SourceItemData;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function SourceItem({
  source,
  isSelected,
  onSelect,
  onRetry,
  onDelete,
  className,
}: SourceItemProps) {
  const isFailed = source.status === "failed" || source.status === "error";

  const getSourceIcon = () => {
    switch (source.type?.toLowerCase()) {
      case "youtube":
        return <Video className="w-3.5 h-3.5 text-ink-secondary" />;
      case "web":
        return <Globe className="w-3.5 h-3.5 text-ink-secondary" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-ink-secondary" />;
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(source.id)}
      className={cn(
        "group flex flex-col p-3 rounded-lg border border-hairline bg-surface hover:bg-surface-subtle transition-colors duration-150 cursor-pointer select-none",
        isSelected && "border-hairline-strong bg-surface-subtle ring-1 ring-gold/40",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 p-1 rounded bg-surface-subtle border border-hairline shrink-0">
            {getSourceIcon()}
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-sans font-medium text-ink truncate leading-tight">
              {source.title}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-mono text-ink-muted uppercase">
                {source.type || "Document"}
              </span>
              {typeof source.tokenCount === "number" && source.tokenCount > 0 && (
                <>
                  <span className="text-ink-muted/40">•</span>
                  <span className="text-[11px] font-mono text-ink-muted">
                    {source.tokenCount.toLocaleString()} tokens
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatusBadge status={source.status} />

          {/* Action options on hover or error */}
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

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(source.id);
              }}
              title="Remove source"
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

      {/* Explicit failure message if present */}
      {isFailed && source.errorMessage && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{source.errorMessage}</span>
        </div>
      )}
    </div>
  );
}
