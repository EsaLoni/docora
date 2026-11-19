"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Key, Check, ExternalLink, X, Clipboard, ShieldCheck, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiKeyModal({ isOpen, onClose }: GeminiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = apiClient.getGeminiApiKey();
      setApiKey(existing || "");
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setApiKey(text.trim());
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 2000);
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = apiKey.trim();
    apiClient.setGeminiApiKey(cleanKey || null);
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleClear = () => {
    apiClient.setGeminiApiKey(null);
    setApiKey("");
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const isAIzaKey = apiKey.trim().startsWith("AIzaSy");
  const isSuspiciousKey = apiKey.trim().length > 0 && !isAIzaKey;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white shadow-2xl overflow-hidden flex flex-col relative z-50 select-none animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-black/[0.08] bg-[#F4F5F7]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 tracking-tight">Connect Google Gemini AI</h3>
              <p className="text-[11px] text-neutral-500">Custom BYOK key or live platform default</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 bg-white">
          <div className="p-3.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-xs space-y-2">
            <p className="text-neutral-800 font-medium leading-relaxed">
              Docora runs grounded RAG and Studio tools (Quizzes, Flashcards, Podcasts) directly via Google Gemini AI.
            </p>
            <div className="flex items-center justify-between pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-amber-700 hover:text-amber-800 font-semibold"
              >
                <span>Get a free key from Google AI Studio</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-micro font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                100% Free
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                Google Gemini API Key
              </label>
              <button
                type="button"
                onClick={handlePaste}
                className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:underline cursor-pointer font-medium"
              >
                <Clipboard className="w-3 h-3" />
                <span>{copiedNotification ? "Pasted!" : "Paste from Clipboard"}</span>
              </button>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                autoFocus
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-[#F4F5F7] text-neutral-900 text-xs placeholder:text-neutral-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-all font-mono"
              />
            </div>

            {isAIzaKey && (
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                <span>Valid Google Gemini API Key format detected.</span>
              </p>
            )}

            {isSuspiciousKey && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Note: Google AI Studio API keys typically start with "AIzaSy...".</span>
              </p>
            )}

            <p className="text-[11px] text-neutral-500">
              Your key is saved locally in your browser and used securely for inference.
            </p>
          </div>

          {isSaved && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Key saved successfully! Ready to generate.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-black/[0.08]">
            {apiClient.getGeminiApiKey() ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition-colors font-medium"
              >
                Clear key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-black/[0.08] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!apiKey.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#E5A93B] text-neutral-950 hover:bg-[#D97706] active:scale-[0.98] disabled:opacity-50 transition-all shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save & Connect</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
