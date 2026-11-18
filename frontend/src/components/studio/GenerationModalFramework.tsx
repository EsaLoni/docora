"use client";

import React from "react";
import { X, Sparkles, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  iconColor?: string;
  onGenerate: () => void;
  onGenerateLater?: () => void;
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
  iconColor = "text-indigo-400 bg-indigo-500/10",
  onGenerate,
  onGenerateLater,
  isGenerating = false,
  generateButtonText = "Generate now",
  children,
}: GenerationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/[0.08] bg-[#0E1118] text-white flex flex-col shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden select-none animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="h-16 border-b border-white/[0.08] px-6 flex items-center justify-between bg-[#0A0C12] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border border-white/[0.08]", iconColor)}>
              <Icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white truncate tracking-tight">{title}</h3>
              <p className="text-[11px] text-neutral-400 truncate">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-7 space-y-6 text-xs text-neutral-300 bg-[#0E1118]">
          {children}
        </div>

        {/* Fixed Bottom Footer */}
        <div className="border-t border-white/[0.08] px-6 py-4 bg-[#0A0C12] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          {/* AI Status Indicator */}
          <div className="flex items-center gap-2.5 text-[11px] text-neutral-400 w-full sm:w-auto">
            <div className="h-5 w-5 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0">
              <Sparkles className="h-3 w-3 text-indigo-400" />
            </div>
            <div>
              <span className="text-neutral-300 font-medium">Model: </span>
              <span>Google Gemini 3.5 Flash</span>
              <span className="hidden md:inline text-neutral-500"> • Grounded inference</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {onGenerateLater && (
              <button
                type="button"
                onClick={onGenerateLater}
                className="px-4 py-2 rounded-xl border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.06] text-xs font-medium transition-all cursor-pointer"
              >
                Generate later
              </button>
            )}

            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] flex items-center gap-2 cursor-pointer active:scale-[0.98]",
                isGenerating
                  ? "bg-indigo-600/60 cursor-not-allowed opacity-80"
                  : "bg-indigo-600 hover:bg-indigo-500"
              )}
            >
              {isGenerating ? (
                <>
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                  <span>Synthesizing with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{generateButtonText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reusable Form Controls for Modals ──

export function ModalSegmentedControl({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex p-1 rounded-xl bg-white/[0.03] border border-white/[0.06] gap-1">
        {options.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-xs font-medium transition-all text-center cursor-pointer",
                isSelected
                  ? "bg-white/[0.1] text-white font-semibold border border-white/[0.12] shadow-xs"
                  : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModalMultiSelectTypes({
  label,
  options,
  selectedValues,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  selectedValues: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {options.map((opt) => {
          const isChecked = selectedValues.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onToggle(opt.id)}
              className={cn(
                "p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all cursor-pointer",
                isChecked
                  ? "bg-indigo-500/15 border-indigo-500/60 text-white shadow-xs"
                  : "bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:text-white hover:border-white/[0.1]"
              )}
            >
              <span>{opt.label}</span>
              {isChecked && <Check className="h-3.5 w-3.5 text-indigo-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ModalLanguageSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Choose language</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer appearance-none"
        >
          <option value="en" className="bg-[#0E1118]">English (US)</option>
          <option value="es" className="bg-[#0E1118]">Spanish (Español)</option>
          <option value="fr" className="bg-[#0E1118]">French (Français)</option>
          <option value="de" className="bg-[#0E1118]">German (Deutsch)</option>
          <option value="hi" className="bg-[#0E1118]">Hindi (हिन्दी)</option>
          <option value="zh" className="bg-[#0E1118]">Chinese (中文)</option>
          <option value="ja" className="bg-[#0E1118]">Japanese (日本語)</option>
          <option value="ar" className="bg-[#0E1118]">Arabic (العربية)</option>
          <option value="pt" className="bg-[#0E1118]">Portuguese (Português)</option>
        </select>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

export function ModalSourceSelector({
  sources,
  selectedIds,
  onToggleSource,
  onSelectAll,
}: {
  sources: SourceItemOption[];
  selectedIds: string[];
  onToggleSource: (id: string) => void;
  onSelectAll: (all: boolean) => void;
}) {
  const allSelected = sources.length > 0 && sources.every((s) => selectedIds.includes(s.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Knowledge sources for grounding</label>
        <button
          type="button"
          onClick={() => onSelectAll(!allSelected)}
          className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer text-[11px]"
        >
          {allSelected ? "Deselect all" : `Select all (${sources.length})`}
        </button>
      </div>

      <div className="max-h-36 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-2 space-y-1">
        {sources.map((src) => {
          const isSelected = selectedIds.includes(src.id);
          return (
            <label
              key={src.id}
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors",
                isSelected ? "bg-white/[0.06] text-white" : "text-neutral-400 hover:bg-white/[0.03]"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSource(src.id)}
                className="h-3.5 w-3.5 rounded border-white/[0.1] bg-white/[0.05] text-indigo-500 focus:ring-0 cursor-pointer"
              />
              <span className="truncate flex-1">{src.title}</span>
              <span className="text-[10px] uppercase text-neutral-400 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                {src.source_type}
              </span>
            </label>
          );
        })}

        {sources.length === 0 && (
          <p className="text-center py-4 text-neutral-500 text-xs">No sources available in notebook.</p>
        )}
      </div>
    </div>
  );
}

export function ModalTopicPrompt({
  value,
  onChange,
  label = "Topic focus",
  placeholder = "e.g. Focus on candidate qualifications, project deliverables, and specific metrics...",
  suggestionChips = [],
  onSelectChip,
}: {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  suggestionChips?: string[];
  onSelectChip?: (chip: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-white placeholder:text-neutral-500 outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none leading-relaxed"
      />

      {suggestionChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-neutral-500 mr-1">Suggestions:</span>
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectChip?.(chip)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.15] text-neutral-300 hover:text-white transition-all cursor-pointer"
            >
              + {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
