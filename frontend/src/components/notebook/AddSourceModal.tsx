"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  FileText,
  Globe,
  Video,
  UploadCloud,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { DocumentItem, SourceItem, apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";

export interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceDocuments?: DocumentItem[];
  existingSources?: SourceItem[];
  onAddSource: (payload: {
    source_type: string;
    title: string;
    document_id?: string;
    url?: string;
    raw_content?: string;
  }) => Promise<void>;
}

type SourceTab = "pdf" | "web" | "youtube";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function AddSourceModal({
  isOpen,
  onClose,
  workspaceDocuments = [],
  existingSources = [],
  onAddSource,
}: AddSourceModalProps) {
  const [activeTab, setActiveTab] = useState<SourceTab>("pdf");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  // Store previously focused element and focus modal on open
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
      // Reset form states
      setValidationError("");
      setUploadFile(null);
      setTitle("");
      setUrl("");
      setIsSubmitting(false);

      // Focus modal or first input after render
      const timer = setTimeout(() => {
        if (activeTab === "pdf") {
          fileInputRef.current?.focus();
        } else {
          urlInputRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      // Return focus to trigger element when closed
      if (previouslyFocusedElementRef.current && previouslyFocusedElementRef.current.focus) {
        previouslyFocusedElementRef.current.focus();
      }
    }
  }, [isOpen, activeTab]);

  // Trap focus inside modal & listen for Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
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

  // File Validation: Type, Size, Duplicate
  const validateAndSetFile = (file: File) => {
    setValidationError("");

    // 1. Check file type (PDF only)
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setValidationError("Unsupported file format. Please upload a PDF (.pdf) document.");
      return;
    }

    // 2. Check file size (25 MB max)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        "File exceeds the 25 MB upload limit. Please upload a smaller file or split it into sections."
      );
      return;
    }

    // 3. Check for duplicates
    const isDuplicate = existingSources.some(
      (s) =>
        s.title.toLowerCase() === file.name.toLowerCase() ||
        s.metadata?.filename?.toLowerCase() === file.name.toLowerCase()
    );
    if (isDuplicate) {
      setValidationError(`This document ("${file.name}") is already attached to this notebook.`);
      return;
    }

    setUploadFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  // URL Validation: Format, Private / Local IP, YouTube Domain, Duplicate
  const validateUrl = (rawUrl: string, type: "web" | "youtube"): { valid: boolean; cleanUrl: string; error?: string } => {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, cleanUrl: "", error: "Please enter a URL." };
    }

    let parsed: URL;
    try {
      const urlWithProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
      parsed = new URL(urlWithProtocol);
    } catch {
      return {
        valid: false,
        cleanUrl: "",
        error: "Please enter a valid HTTP or HTTPS URL (e.g., https://example.com/article).",
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Check for private network / local addresses
    const isPrivate =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isPrivate) {
      return {
        valid: false,
        cleanUrl: "",
        error: "Private network or local addresses (localhost, private IPs) cannot be ingested.",
      };
    }

    // YouTube specific validation
    if (type === "youtube") {
      const isYoutube =
        hostname === "youtube.com" ||
        hostname === "www.youtube.com" ||
        hostname === "m.youtube.com" ||
        hostname === "youtu.be";

      if (!isYoutube) {
        return {
          valid: false,
          cleanUrl: "",
          error: "Please enter a valid YouTube video URL (e.g., https://youtube.com/watch?v=... or https://youtu.be/...).",
        };
      }
    }

    // Check duplicate URL
    const isDuplicate = existingSources.some(
      (s) => s.url && s.url.toLowerCase() === parsed.toString().toLowerCase()
    );
    if (isDuplicate) {
      return {
        valid: false,
        cleanUrl: "",
        error: `This ${type === "youtube" ? "YouTube video" : "URL"} is already attached to this notebook.`,
      };
    }

    return { valid: true, cleanUrl: parsed.toString() };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (activeTab === "pdf") {
      if (!uploadFile) {
        setValidationError("Please select or drop a PDF file to upload.");
        return;
      }

      setIsSubmitting(true);
      try {
        const uploadedDoc = await apiClient.uploadDocument(uploadFile);
        await onAddSource({
          source_type: "document",
          title: title.trim() || uploadFile.name,
          document_id: uploadedDoc.id,
        });
        onClose();
      } catch (err: any) {
        setValidationError(err.message || "Failed to upload and index document.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const validation = validateUrl(url, activeTab);
      if (!validation.valid) {
        setValidationError(validation.error || "Invalid URL.");
        return;
      }

      setIsSubmitting(true);
      try {
        await onAddSource({
          source_type: activeTab === "youtube" ? "youtube" : "url",
          title: title.trim() || validation.cleanUrl,
          url: validation.cleanUrl,
        });
        onClose();
      } catch (err: any) {
        setValidationError(err.message || `Failed to attach ${activeTab === "youtube" ? "YouTube video" : "web page"}.`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-source-title"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-xl border border-hairline bg-surface shadow-xl flex flex-col overflow-hidden text-ink font-sans select-none animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-hairline flex items-center justify-between shrink-0 bg-surface">
          <div>
            <h3 id="add-source-title" className="text-section font-semibold text-ink">
              Add Knowledge Source
            </h3>
            <p className="text-caption text-ink-muted leading-tight">
              Ground your synthesis in documents, web articles, or video transcripts.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-ink-muted hover:text-ink"
            aria-label="Close dialog (Esc)"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tab Controls: PDF, Web, YouTube */}
        <div className="px-5 pt-4 pb-2">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface-subtle border border-hairline">
            <button
              type="button"
              onClick={() => {
                setActiveTab("pdf");
                setValidationError("");
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-ui transition-colors duration-150 cursor-pointer ${
                activeTab === "pdf"
                  ? "bg-surface text-ink font-medium shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Document</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("web");
                setValidationError("");
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-ui transition-colors duration-150 cursor-pointer ${
                activeTab === "web"
                  ? "bg-surface text-ink font-medium shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Page</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("youtube");
                setValidationError("");
              }}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded text-ui transition-colors duration-150 cursor-pointer ${
                activeTab === "youtube"
                  ? "bg-surface text-ink font-medium shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>YouTube Video</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Validation Alert */}
          {validationError && (
            <div className="p-3 rounded-lg bg-destructive-subtle border border-destructive-border flex items-start gap-2 text-ui text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{validationError}</span>
            </div>
          )}

          {activeTab === "pdf" ? (
            /* PDF Upload Dropzone */
            <div className="space-y-3">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors duration-150 ${
                  isDragging
                    ? "border-border-strong bg-surface-subtle"
                    : "border-border-hairline hover:border-border-strong hover:bg-surface-subtle"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-2.5 rounded-full bg-surface-subtle border border-hairline mb-2 text-ink-muted">
                  <UploadCloud className="w-6 h-6" />
                </div>
                {uploadFile ? (
                  <div className="space-y-1">
                    <p className="text-ui font-medium text-ink break-words">
                      {uploadFile.name}
                    </p>
                    <p className="text-micro font-mono text-ink-muted">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to attach
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-ui font-medium text-ink">
                      Drag and drop a PDF file here, or click to browse
                    </p>
                    <p className="text-micro text-ink-muted font-mono">
                      PDF documents up to 25 MB
                    </p>
                  </div>
                )}
              </div>

              {/* Title input */}
              <div className="space-y-1">
                <label className="text-caption font-medium text-ink">
                  Source Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Q3 Financial Review or Indian Airlines Analytics"
                  className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
                />
              </div>
            </div>
          ) : (
            /* Web URL / YouTube URL Input */
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-caption font-medium text-ink">
                  {activeTab === "youtube" ? "YouTube Video Link" : "Web Article or Page URL"}
                </label>
                <input
                  ref={urlInputRef}
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (validationError) setValidationError("");
                  }}
                  placeholder={
                    activeTab === "youtube"
                      ? "https://www.youtube.com/watch?v=..."
                      : "https://example.com/research-report"
                  }
                  className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
                />
                <p className="text-micro text-ink-muted">
                  {activeTab === "youtube"
                    ? "Paste any public YouTube video link with transcript capabilities."
                    : "Paste any public web page URL to parse and index its textual content."}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-caption font-medium text-ink">
                  Display Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Custom name for this source in your notebook"
                  className="w-full px-3 py-2 rounded-lg border border-hairline bg-surface text-[16px] sm:text-ui text-ink placeholder:text-ink-muted outline-none focus:ring-1 focus:ring-border-strong"
                />
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-3 border-t border-hairline flex items-center justify-end gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-ui"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="text-ui flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Attaching...</span>
                </>
              ) : (
                <span>Attach to Notebook</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
