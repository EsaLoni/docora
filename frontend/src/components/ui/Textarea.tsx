"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          // 16px font size on mobile (<640px) to prevent iOS auto-zoom, scaling to 13px on desktop
          "w-full px-3 py-2 rounded-lg border border-hairline bg-surface-subtle text-ink text-[16px] sm:text-ui font-sans placeholder:text-ink-muted transition-colors duration-150 outline-none shadow-xs resize-y",
          "focus-visible:border-strong focus-visible:bg-surface focus-visible:ring-1 focus-visible:ring-gold",
          error && "border-destructive focus-visible:ring-destructive",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
