"use client";

import React from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  RotateCw,
  FileText,
} from "lucide-react";
import { useUpload, QueueItem } from "@/context/UploadContext";
import { cn } from "@/lib/utils";

export function UploadQueueWidget() {
  const { queue, isExpanded, setIsExpanded, removeItem, retryItem, clearCompleted, activeCount } = useUpload();

  if (queue.length === 0) return null;

  const completedCount = queue.filter((i) => i.status === "ready").length;
  const failedCount = queue.filter((i) => i.status === "failed").length;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Expanded Tray */}
      {isExpanded && (
        <div className="w-80 sm:w-96 bg-card border rounded-2xl shadow-2xl mb-3 overflow-hidden text-left animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="p-3.5 border-b flex items-center justify-between bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground">Upload & Processing</span>
              {activeCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {activeCount} active
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  All Complete
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={clearCompleted}
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium transition"
                >
                  Clear Done
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Items List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-border/60">
            {queue.map((item) => (
              <div key={item.id} className="p-3 text-xs space-y-1.5 hover:bg-muted/20 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-foreground truncate">{item.filename}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === "ready" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-600 font-medium">
                        <AlertCircle className="h-3.5 w-3.5" /> Failed
                      </span>
                    )}
                    {(item.status === "uploading" || item.status === "processing" || item.status === "waiting") && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium capitalize">
                        <Loader2 className="h-3 w-3 animate-spin" /> {item.status}
                      </span>
                    )}

                    {item.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => retryItem(item.id)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        title="Retry"
                      >
                        <RotateCw className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(item.status === "uploading" || item.status === "processing" || item.status === "waiting") && (
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${Math.max(15, item.progress)}%` }}
                    />
                  </div>
                )}

                {item.errorMessage && (
                  <p className="text-[11px] text-red-500 leading-tight">{item.errorMessage}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Status Pill Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg border text-xs font-semibold backdrop-blur-md transition-all cursor-pointer",
          activeCount > 0
            ? "bg-primary text-primary-foreground border-primary/20 hover:bg-primary/95"
            : failedCount > 0
            ? "bg-card text-foreground border-red-300 hover:bg-muted"
            : "bg-card text-foreground border-border hover:bg-muted"
        )}
      >
        {activeCount > 0 ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Processing {activeCount} {activeCount === 1 ? "document" : "documents"}...</span>
            <ChevronUp className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{completedCount} {completedCount === 1 ? "document" : "documents"} processed</span>
            <ChevronUp className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
          </>
        )}
      </button>
    </div>
  );
}
