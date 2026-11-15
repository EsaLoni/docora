"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BrandLogoProps {
  variant?: "icon" | "full" | "compact";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  theme?: "dark" | "light" | "auto";
  showTagline?: boolean;
  tagline?: string;
  href?: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}

const sizeConfig = {
  xs: { icon: 20, text: "text-xs font-semibold", tagline: "text-[9px]" },
  sm: { icon: 24, text: "text-sm font-semibold", tagline: "text-[10px]" },
  md: { icon: 32, text: "text-base font-bold", tagline: "text-[11px]" },
  lg: { icon: 40, text: "text-xl font-bold", tagline: "text-xs" },
  xl: { icon: 48, text: "text-2xl font-bold", tagline: "text-sm" },
};

export function DocoraSymbol({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 select-none", className)}
      aria-label="Docora brand symbol"
    >
      <defs>
        <linearGradient id="docora-primary-sym" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="45%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="docora-accent-sym" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#818CF8" />
        </linearGradient>
        <linearGradient id="docora-sparkle-sym" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>
      </defs>

      {/* Document Silhouette & Geometric 'D' Monogram */}
      <path
        d="M10 8C10 5.79086 11.7909 4 14 4H26C35.9411 4 41 10.5 41 24C41 37.5 35.9411 44 26 44H14C11.7909 44 10 42.2091 10 40V8Z"
        fill="url(#docora-primary-sym)"
      />

      {/* Inner Document Window / Aperture */}
      <path
        d="M17 11H25C31.5 11 34.5 15.5 34.5 24C34.5 32.5 31.5 37 25 37H17V11Z"
        fill="currentColor"
        className="text-[#0B0F19] dark:text-[#0B0F19]"
      />

      {/* Dimensional Page Fold in Top-Right */}
      <path
        d="M26 4V13C26 14.6569 27.3431 16 29 16H38.5L26 4Z"
        fill="url(#docora-accent-sym)"
      />

      {/* AI Intelligence Core (Four-Point Astroid Sparkle) */}
      <path
        d="M24 17C24 20.866 21.3137 24 17.5 24C21.3137 24 24 27.134 24 31C24 27.134 26.6863 24 30.5 24C26.6863 24 24 20.866 24 17Z"
        fill="url(#docora-sparkle-sym)"
      />

      {/* Secondary Satellite Node */}
      <circle cx="31.5" cy="18.5" r="1.5" fill="#38BDF8" />
    </svg>
  );
}

export function BrandLogo({
  variant = "full",
  size = "md",
  theme = "auto",
  showTagline = false,
  tagline = "Your documents. Your intelligence.",
  href,
  className,
  iconClassName,
  textClassName,
}: BrandLogoProps) {
  const currentSize = sizeConfig[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 select-none transition-opacity",
        href ? "hover:opacity-90 cursor-pointer" : "",
        className
      )}
    >
      <DocoraSymbol size={currentSize.icon} className={iconClassName} />

      {variant !== "icon" && (
        <div className="flex flex-col min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "tracking-tight text-foreground font-sans font-bold",
                theme === "dark" ? "text-white" : "",
                theme === "light" ? "text-slate-900" : "",
                currentSize.text,
                textClassName
              )}
            >
              Docora
            </span>
            {variant === "compact" && (
              <span className="text-[10px] px-1.5 py-0.2 bg-primary/10 text-primary border border-primary/20 rounded font-medium tracking-normal">
                AI
              </span>
            )}
          </div>
          {showTagline && (
            <span
              className={cn(
                "text-muted-foreground truncate leading-none mt-0.5",
                currentSize.tagline
              )}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center no-underline">
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;
