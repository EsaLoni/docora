"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, Key, Check, ExternalLink, X, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface GeminiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiKeyModal({ isOpen, onClose }: GeminiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = apiClient.getGeminiApiKey();
      setApiKey(existing || "");
      setIsSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setGeminiApiKey(apiKey.trim() || null);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#273247] bg-[#151B27] shadow-2xl overflow-hidden flex flex-col relative z-50 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#273247] bg-[#10141D]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#6D8FFF]/10 border border-[#6D8FFF]/30 flex items-center justify-center text-[#6D8FFF]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#F1F5FC]">Connect Google Gemini AI</h3>
              <p className="text-[11px] text-[#A0AEC0]">Direct API key integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-[#1B2332] border border-[#273247] text-xs space-y-2">
            <p className="text-[#F1F5FC] font-medium leading-relaxed">
              Use your own free Google Gemini API key to query documents without limits or shared server quotas.
            </p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[#6D8FFF] hover:underline font-semibold"
            >
              <span>Get a free key from Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#A0AEC0]">
              Google Gemini API Key
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A0AEC0]">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs placeholder:text-[#A0AEC0]/40 focus:border-[#6D8FFF] outline-hidden font-mono"
              />
            </div>
            <p className="text-[11px] text-[#A0AEC0]">
              Your key is saved locally in your browser and sent securely only for your queries.
            </p>
          </div>

          {isSaved && (
            <div className="p-2.5 rounded-xl bg-[#34D399]/10 border border-[#34D399]/30 text-[#34D399] text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Credentials saved successfully!</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {apiClient.getGeminiApiKey() ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-400/10 transition-colors"
              >
                Clear key
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#6D8FFF] text-[#0B0D12] hover:bg-[#84A2FF] transition-colors flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Key</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
