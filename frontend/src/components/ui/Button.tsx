"use client";

import React, { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-sans font-medium transition-colors duration-150 rounded-lg select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 active:scale-[0.98]";

    const variantStyles = {
      // Primary: Kinpaku Gold strictly for primary actions, pure white text (WCAG AA > 4.5:1)
      primary:
        "bg-gold text-gold-fg hover:bg-gold-hover active:bg-gold-active shadow-xs",
      // Secondary: Crisp paper sheet button with hairline stroke
      secondary:
        "bg-surface border border-hairline text-ink hover:bg-surface-subtle shadow-xs",
      // Ghost: Borderless, resting with text-ink-secondary
      ghost:
        "text-ink-secondary hover:text-ink hover:bg-surface-subtle",
      // Destructive: Restrained crimson
      destructive:
        "bg-destructive-subtle text-destructive border border-destructive-border hover:opacity-90 shadow-xs",
    };

    const sizeStyles = {
      // Minimum text size 11px
      sm: "h-8 px-2.5 text-[12px] gap-1.5",
      md: "h-9 px-3.5 text-[13px] gap-2",
      lg: "h-10 px-4 text-[14px] gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin -ml-0.5 h-3.5 w-3.5 text-current shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
