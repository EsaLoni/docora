"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Key,
  ExternalLink,
  Check,
  Trash2,
  AlertTriangle,
  Sliders,
  Database,
  Lock,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const { user } = useAuth();
  const [retrievalMode, setRetrievalMode] = useState("hybrid");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [savedSettings, setSavedSettings] = useState(false);
  const [savedGemini, setSavedGemini] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const existingKey = apiClient.getGeminiApiKey();
    if (existingKey) {
      setGeminiApiKey(existingKey);
    }
  }, []);

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setGeminiApiKey(geminiApiKey.trim() || null);
    setSavedGemini(true);
    setTimeout(() => setSavedGemini(false), 2000);
  };

  const handleConfirmClearKey = () => {
    apiClient.setGeminiApiKey(null);
    setGeminiApiKey("");
    setShowClearConfirm(false);
    setSavedGemini(true);
    setTimeout(() => setSavedGemini(false), 2000);
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans select-none pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-serif text-title font-semibold text-ink tracking-tight">
            Settings & Environment
          </h1>
          <p className="text-ui text-ink-secondary mt-1">
            Configure application credentials, retrieval models, and data security.
          </p>
        </div>

        {/* Group 1: Workspace & Tenant Identity */}
        <section className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-verdigris" />
            <h2 className="text-section font-semibold text-ink">
              Workspace & Security
            </h2>
          </div>
          <p className="text-caption text-ink-secondary leading-relaxed">
            All document chunks, vector embeddings, conversations, and studio artifacts are partitioned strictly by workspace ID.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-lg bg-surface-subtle border border-hairline space-y-0.5">
              <span className="text-micro font-mono uppercase text-ink-muted">
                Authenticated Account
              </span>
              <p className="text-ui font-medium text-ink truncate">
                {user?.email || "Personal Research Session"}
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-surface-subtle border border-hairline space-y-0.5">
              <span className="text-micro font-mono uppercase text-ink-muted">
                Active Workspace
              </span>
              <p className="text-ui font-medium text-ink truncate">
                {user?.workspaces?.[0]?.name || "Default Workspace"}
              </p>
            </div>
          </div>
        </section>

        {/* Group 2: Google Gemini Credentials (BYOK) */}
        <section className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-gold" />
              <h2 className="text-section font-semibold text-ink">
                Google Gemini API Key
              </h2>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-caption text-ink hover:underline flex items-center gap-1 font-medium"
            >
              <span>Get Free Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-caption text-ink-secondary leading-relaxed">
            Provide your personal Gemini API key for dedicated rate capacity and zero queue wait times. Keys are stored locally in your browser and transmitted securely over HTTPS directly to the endpoint.
          </p>

          <form onSubmit={handleSaveGeminiKey} className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-caption font-medium text-ink block">
                API Key
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-ink font-mono text-[16px] sm:text-ui outline-none focus:ring-1 focus:ring-border-strong placeholder:text-ink-muted"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {geminiApiKey ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-caption text-destructive hover:underline cursor-pointer"
                >
                  Clear Key
                </button>
              ) : (
                <div />
              )}

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-ui"
              >
                {savedGemini ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Key Saved</span>
                  </>
                ) : (
                  <span>Save Gemini Key</span>
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* Group 3: Synthesis & Retrieval Preferences */}
        <section className="rounded-xl border border-hairline bg-surface p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-ink-secondary" />
            <h2 className="text-section font-semibold text-ink">
              Retrieval & Synthesis Mode
            </h2>
          </div>

          <p className="text-caption text-ink-secondary leading-relaxed">
            Configure how documents are indexed and matched against inquiries.
          </p>

          <form onSubmit={handleSavePreferences} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-caption font-medium text-ink block">
                Default Retrieval Method
              </label>
              <select
                value={retrievalMode}
                onChange={(e) => setRetrievalMode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink outline-none focus:ring-1 focus:ring-border-strong cursor-pointer"
              >
                <option value="hybrid">
                  Hybrid RAG (Reciprocal Rank Fusion — Dense Embeddings + BM25 Lexical)
                </option>
                <option value="vector">
                  Dense Vector Only (Cosine Similarity on 384d Embeddings)
                </option>
                <option value="keyword">
                  Lexical BM25 Only (Exact Keyword Matching)
                </option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-hairline">
              <span className="text-micro font-mono text-ink-muted">
                Endpoint: {apiClient.getBaseUrl() || "relative origin"}
              </span>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-ui"
              >
                {savedSettings ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save Preferences</span>
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* Group 4: Destructive Actions (Separated with Warning) */}
        <section className="rounded-xl border border-destructive-border bg-destructive-subtle/30 p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <h2 className="text-section font-semibold text-destructive">
              Destructive Actions
            </h2>
          </div>
          <p className="text-caption text-ink-secondary leading-relaxed">
            Clear stored local credentials or reset local workspace preferences. This action cannot be reversed.
          </p>

          <div className="pt-2 flex items-center gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="text-ui"
            >
              Clear API Credentials
            </Button>
          </div>
        </section>

        {/* Clear Credentials Confirmation Modal */}
        {showClearConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          >
            <div className="w-full max-w-sm rounded-xl border border-hairline bg-surface p-5 space-y-4 shadow-xl text-ink font-sans">
              <h3 className="text-section font-semibold text-ink">
                Clear Gemini API Key?
              </h3>
              <p className="text-caption text-ink-secondary leading-relaxed">
                Your key will be permanently removed from this browser session. Future queries will run on the shared fallback tier.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleConfirmClearKey}
                >
                  Clear Key
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
