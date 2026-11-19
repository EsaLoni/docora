"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { X, Sparkles, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface SourceItemOption {
  id: string;
  title: string;
  source_type: string;
  is_active: boolean;
}

export interface GenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  onGenerate: () => void;
  isGenerating?: boolean;
  generateButtonText?: string;
  children: React.ReactNode;
}

export function GenerationModal({
  isOpen,
  onClose,
  title,
  subtitle = "Synthesized from active notebook sources using Google Gemini.",
  icon: Icon,
  onGenerate,
  isGenerating = false,
  generateButtonText = "Generate Output",
  children,
}: GenerationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement;
      const timer = setTimeout(() => {
        const firstInput = modalRef.current?.querySelector<HTMLElement>(
          'input, textarea, button:not([aria-label*="Close"])'
        );
        firstInput?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      if (previouslyFocusedRef.current?.focus) {
        previouslyFocusedRef.current.focus();
      }
    }
  }, [isOpen]);

  // Trap focus and listen for Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gen-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150 select-none"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-xl border border-hairline bg-surface text-ink flex flex-col shadow-xl overflow-hidden font-sans animate-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <div className="h-14 border-b border-hairline px-5 flex items-center justify-between bg-surface shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-surface-subtle border border-hairline flex items-center justify-center shrink-0 text-ink">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 id="gen-modal-title" className="text-section font-semibold text-ink truncate leading-tight">
                {title}
              </h3>
              <p className="text-micro text-ink-muted truncate">{subtitle}</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-ink-muted hover:text-ink shrink-0"
            aria-label="Close dialog (Esc)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-ui text-ink bg-surface max-h-[70vh] overflow-y-auto">
          {children}
        </div>

        {/* Modal Footer: One single primary action */}
        <div className="border-t border-hairline px-5 py-3.5 bg-surface-subtle/50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-micro text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-verdigris" />
            <span>Grounded synthesis</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isGenerating}
              className="text-ui"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onGenerate}
              disabled={isGenerating}
              className="text-ui flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <span>{generateButtonText}</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Option Segmented Control (Length / Focus / Depth)
export function ModalSegmentedControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string; desc?: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-caption font-medium text-ink block">{label}</label>
      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-subtle border border-hairline">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`py-1.5 px-2 rounded text-caption font-medium transition-colors duration-150 cursor-pointer text-center ${
              value === opt.id
                ? "bg-surface text-ink shadow-xs font-semibold"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            <div>{opt.label}</div>
            {opt.desc && (
              <div className="text-micro font-normal text-ink-muted mt-0.5">{opt.desc}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Focus Topic Input
export function ModalTopicPrompt({
  topic,
  setTopic,
  placeholder = "e.g., Executive summary of key findings, risks, or specific chapter",
}: {
  topic: string;
  setTopic: (t: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-caption font-medium text-ink block">
        Focus Topic (Optional)
      </label>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
      />
      <p className="text-micro text-ink-muted">
        Leave blank to synthesize across all active documents, or specify a particular angle.
      </p>
    </div>
  );
}
