"use client";

import React, { useState, useRef } from "react";
import { X, FileText, Globe, StickyNote, ExternalLink, UploadCloud, AlertCircle } from "lucide-react";
import { DocumentItem, apiClient } from "@/lib/api-client";

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceDocuments: DocumentItem[];
  onAddSource: (payload: {
    source_type: string;
    title: string;
    document_id?: string;
    url?: string;
    raw_content?: string;
  }) => Promise<void>;
}

export function AddSourceModal({
  isOpen,
  onClose,
  workspaceDocuments,
  onAddSource,
}: AddSourceModalProps) {
  const [sourceType, setSourceType] = useState<"document" | "url" | "youtube" | "text">("document");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadError, setUploadError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      setUploadStatus("idle");
      setUploadError("");
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setUploadFile(file);
      setUploadStatus("idle");
      setUploadError("");
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setUploadError("");

    try {
      const payload: any = {
        source_type: sourceType,
        title: title.trim() || (sourceType === "url" ? url : "Uploaded Source"),
      };

      if (sourceType === "document") {
        if (uploadFile) {
          setUploadStatus("uploading");
          const uploadedDoc = await apiClient.uploadDocument(uploadFile);
          payload.document_id = uploadedDoc.id;
          payload.title = title.trim() || uploadFile.name;
          setUploadStatus("success");
        } else if (selectedDocId) {
          payload.document_id = selectedDocId;
          const matched = workspaceDocuments.find((d) => d.id === selectedDocId);
          if (matched) payload.title = title.trim() || matched.title || matched.filename;
        } else {
          setUploadError("Please choose a file to upload or select an existing document.");
          setIsSubmitting(false);
          return;
        }
      } else if (sourceType === "url" || sourceType === "youtube") {
        payload.url = url;
        payload.title = title.trim() || url;
      } else if (sourceType === "text") {
        payload.raw_content = rawText;
        payload.title = title.trim() || "Pasted Content";
      }

      await onAddSource(payload);
      onClose();
      setTitle("");
      setUrl("");
      setRawText("");
      setSelectedDocId("");
      setUploadFile(null);
      setUploadStatus("idle");
    } catch (err: any) {
      setUploadError(err.message || "Failed to add source. Please check backend status.");
      setUploadStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0E1118] shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] overflow-hidden flex flex-col relative z-50 animate-in fade-in zoom-in-95 select-none">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08] bg-[#0A0C12]">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-tight">Add Knowledge Source</h3>
            <p className="text-[11px] text-neutral-400">Ground queries and studio artifacts in these materials</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Type Selector */}
        <div className="p-2.5 grid grid-cols-4 gap-1.5 bg-[#0A0C12] border-b border-white/[0.08]">
          {[
            { id: "document", label: "Files", icon: FileText },
            { id: "url", label: "Web Link", icon: Globe },
            { id: "youtube", label: "YouTube", icon: ExternalLink },
            { id: "text", label: "Text", icon: StickyNote },
          ].map((type) => {
            const Icon = type.icon;
            const isSelected = sourceType === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => {
                  setSourceType(type.id as any);
                  setUploadError("");
                }}
                className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-white/[0.08] text-white border border-white/[0.1] shadow-xs"
                    : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? "text-indigo-400" : "text-neutral-500"}`} />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#0E1118]">
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{uploadError}</span>
            </div>
          )}

          {sourceType === "document" && (
            <div className="space-y-3">
              {/* Direct File Upload Dropzone */}
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                  Upload File from Computer (PDF, DOCX, TXT, XLSX, CSV)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    uploadFile
                      ? "border-indigo-500/60 bg-indigo-500/5 shadow-[inset_0_1px_0_0_rgba(99,102,241,0.1)]"
                      : "border-white/[0.1] hover:border-indigo-500/40 bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.csv,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <UploadCloud className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
                  {uploadFile ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white">{uploadFile.name}</p>
                      <p className="text-[11px] text-neutral-400">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB • Ready to attach
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-neutral-200">
                        Click or drag file here to upload
                      </p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        PDF, DOCX, XLSX, TXT up to 25 MB
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Or Select from Workspace Documents */}
              {workspaceDocuments && workspaceDocuments.length > 0 ? (
                <div>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-white/[0.06]"></div>
                    <span className="flex-shrink mx-2 text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                      OR CHOOSE EXISTING DOCUMENT
                    </span>
                    <div className="flex-grow border-t border-white/[0.06]"></div>
                  </div>
                  <select
                    value={selectedDocId}
                    onChange={(e) => {
                      setSelectedDocId(e.target.value);
                      if (e.target.value) setUploadFile(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all mt-1"
                  >
                    <option value="" className="bg-[#0E1118] text-neutral-300">
                      -- Choose from {workspaceDocuments.length} workspace documents --
                    </option>
                    {workspaceDocuments.map((doc) => (
                      <option key={doc.id} value={doc.id} className="bg-[#0E1118] text-white">
                        {doc.title || doc.filename}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-neutral-500 text-center italic">
                  Upload a file above to add your first document to this workspace.
                </p>
              )}
            </div>
          )}

          {(sourceType === "url" || sourceType === "youtube") && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                {sourceType === "youtube" ? "YouTube Video URL" : "Web Page URL"}
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={sourceType === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://..."}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all"
              />
            </div>
          )}

          {sourceType === "text" && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
                Pasted Notes or Text
              </label>
              <textarea
                required
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste research excerpts, meeting transcripts, or markdown..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all resize-none"
              />
            </div>
          )}

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5 block">
              Source Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Custom source display name..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/30 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/[0.08] text-xs font-medium text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] active:scale-[0.98] flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{uploadStatus === "uploading" ? "Uploading file..." : "Adding source..."}</span>
                </>
              ) : (
                <span>Add to Notebook</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
