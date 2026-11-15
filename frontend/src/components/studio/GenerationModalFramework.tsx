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
  iconColor?: string; // e.g. "text-blue-400 bg-blue-500/10"
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
  iconColor = "text-blue-400 bg-blue-500/10",
  onGenerate,
  onGenerateLater,
  isGenerating = false,
  generateButtonText = "Generate now",
  children,
}: GenerationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border border-[#303030] bg-[#202020] text-[#F5F5F5] flex flex-col shadow-2xl overflow-hidden select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Header ── */}
        <div className="h-16 border-b border-[#303030] px-6 flex items-center justify-between bg-[#1E1E1E]/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", iconColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-[#F5F5F5] truncate tracking-tight">{title}</h3>
              <p className="text-[11px] text-[#858585] truncate">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#858585] hover:text-[#F5F5F5] hover:bg-[#292929] transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Modal Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-xs text-[#B7B7B7] bg-[#1E1E1E]/40">
          {children}
        </div>

        {/* ── Fixed Bottom Footer ── */}
        <div className="border-t border-[#303030] px-6 py-4 bg-[#1A1A1A] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
          {/* AI Usage Indicator */}
          <div className="flex items-center gap-2.5 text-[11px] text-[#858585] w-full sm:w-auto">
            <div className="h-5 w-5 rounded-md bg-[#292929] text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-3 w-3 text-[#3156D8]" />
            </div>
            <div>
              <span className="text-[#B7B7B7] font-medium">AI usage: </span>
              <span>4 / 50 used this month</span>
              <span className="hidden md:inline text-[#858585]"> • ~1 credit estimated</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {onGenerateLater && (
              <button
                type="button"
                onClick={onGenerateLater}
                className="px-4 py-2 rounded-xl border border-[#303030] hover:border-[#494949] text-[#B7B7B7] hover:text-[#F5F5F5] hover:bg-[#292929] text-xs font-medium transition-all cursor-pointer"
              >
                Generate later
              </button>
            )}

            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className={cn(
                "px-5 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer",
                isGenerating
                  ? "bg-[#3156D8]/60 cursor-not-allowed opacity-80"
                  : "bg-[#3156D8] hover:bg-[#2846b8] active:scale-98"
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
      <label className="block text-xs font-semibold text-[#F5F5F5]">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex p-1 rounded-xl bg-[#171717] border border-[#303030] gap-1">
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
                  ? "bg-[#292929] text-[#F5F5F5] font-semibold border border-[#494949] shadow-2xs"
                  : "text-[#858585] hover:text-[#B7B7B7] hover:bg-[#202020]"
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
      <label className="block text-xs font-semibold text-[#F5F5F5]">{label}</label>
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
                  ? "bg-[#3156D8]/15 border-[#3156D8] text-[#F5F5F5]"
                  : "bg-[#171717] border-[#303030] text-[#858585] hover:text-[#B7B7B7] hover:border-[#494949]"
              )}
            >
              <span>{opt.label}</span>
              {isChecked && <Check className="h-3.5 w-3.5 text-[#3156D8]" />}
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
      <label className="block text-xs font-semibold text-[#F5F5F5]">Choose language</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl bg-[#171717] border border-[#303030] text-xs text-[#F5F5F5] outline-none focus:border-[#3156D8] transition-colors cursor-pointer appearance-none"
        >
          <option value="en">English (US)</option>
          <option value="es">Spanish (Español)</option>
          <option value="fr">French (Français)</option>
          <option value="de">German (Deutsch)</option>
          <option value="hi">Hindi (हिन्दी)</option>
          <option value="zh">Chinese (中文)</option>
          <option value="ja">Japanese (日本語)</option>
          <option value="ar">Arabic (العربية)</option>
          <option value="pt">Portuguese (Português)</option>
        </select>
        <ChevronDown className="h-3.5 w-3.5 text-[#858585] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
        <label className="font-semibold text-[#F5F5F5]">Knowledge sources for grounding</label>
        <button
          type="button"
          onClick={() => onSelectAll(!allSelected)}
          className="text-[#3156D8] hover:underline font-medium cursor-pointer text-[11px]"
        >
          {allSelected ? "Deselect all" : `Select all (${sources.length})`}
        </button>
      </div>

      <div className="max-h-36 overflow-y-auto rounded-xl border border-[#303030] bg-[#171717] p-2 space-y-1">
        {sources.map((src) => {
          const isSelected = selectedIds.includes(src.id);
          return (
            <label
              key={src.id}
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer transition-colors",
                isSelected ? "bg-[#202020] text-[#F5F5F5]" : "text-[#858585] hover:bg-[#1E1E1E]"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSource(src.id)}
                className="h-3.5 w-3.5 rounded border-[#494949] text-[#3156D8] focus:ring-0 cursor-pointer"
              />
              <span className="truncate flex-1">{src.title}</span>
              <span className="text-[10px] uppercase text-[#858585] px-1.5 py-0.2 rounded bg-[#292929]">
                {src.source_type}
              </span>
            </label>
          );
        })}

        {sources.length === 0 && (
          <p className="text-center py-4 text-[#858585] text-xs">No sources available in notebook.</p>
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
      <label className="block text-xs font-semibold text-[#F5F5F5]">{label}</label>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl bg-[#171717] border border-[#303030] text-xs text-[#F5F5F5] placeholder:text-[#858585] outline-none focus:border-[#3156D8] transition-colors resize-none leading-relaxed"
      />

      {suggestionChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-[#858585] mr-1">Suggestions:</span>
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectChip?.(chip)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-[#202020] hover:bg-[#292929] border border-[#303030] hover:border-[#494949] text-[#B7B7B7] hover:text-[#F5F5F5] transition-all cursor-pointer"
            >
              + {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
