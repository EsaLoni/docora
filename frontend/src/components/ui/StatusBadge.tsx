"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "ready"
  | "indexed"
  | "uploading"
  | "extracting"
  | "indexing"
  | "generating"
  | "queued"
  | "idle"
  | "failed"
  | "error";

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalized = status.toLowerCase() as StatusType;

  // Real status mapping without neon or glowing artifacts
  const isVerified = normalized === "ready" || normalized === "indexed";
  const isProcessing =
    normalized === "uploading" ||
    normalized === "extracting" ||
    normalized === "indexing" ||
    normalized === "generating";
  const isIdle = normalized === "idle" || normalized === "queued";
  const isFailed = normalized === "failed" || normalized === "error";

  const displayLabel =
    label ||
    (isVerified
      ? "Ready"
      : normalized === "uploading"
      ? "Uploading"
      : normalized === "extracting"
      ? "Extracting"
      : normalized === "indexing"
      ? "Indexing"
      : normalized === "generating"
      ? "Generating"
      : normalized === "queued"
      ? "Queued"
      : isFailed
      ? "Failed"
      : "Idle");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-sans font-medium select-none shrink-0",
        // Verified / Ready: Verdigris
        isVerified && "bg-verdigris-subtle text-verdigris border border-verdigris",
        // Processing / Active: Warm amber ink on subtle paper
        isProcessing &&
          "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
        // Idle / Queued: Neutral muted
        isIdle && "bg-surface-subtle text-ink-muted border border-hairline",
        // Failed / Error: Restrained crimson
        isFailed &&
          "bg-destructive-subtle text-destructive border border-destructive-border",
        className
      )}
    >
      {/* Restrained pulse indicator for active processing states */}
      {isProcessing && (
        <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
      )}
      {isVerified && (
        <span className="h-1.5 w-1.5 rounded-full bg-verdigris" />
      )}
      {isFailed && (
        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}
