"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // 16px font size on mobile (<640px) to prevent iOS auto-zoom, scaling to 13px on desktop
          "w-full h-9 px-3 rounded-lg border border-hairline bg-surface-subtle text-ink text-[16px] sm:text-[13px] font-sans placeholder:text-ink-muted transition-colors duration-150 outline-none shadow-xs",
          "focus-visible:border-hairline-strong focus-visible:bg-surface focus-visible:ring-1 focus-visible:ring-gold",
          error && "border-destructive focus-visible:ring-destructive",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
