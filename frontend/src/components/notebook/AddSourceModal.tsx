"use client";

import React, { useState, useRef } from "react";
import { X, FileText, Globe, StickyNote, ExternalLink, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
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
      <div className="w-full max-w-lg rounded-2xl border border-[#273247] bg-[#151B27] shadow-2xl overflow-hidden flex flex-col relative z-50 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#273247] bg-[#10141D]">
          <h3 className="text-sm font-semibold text-[#F1F5FC]">Add Knowledge Source</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Type Selector */}
        <div className="p-3 grid grid-cols-4 gap-1.5 bg-[#10141D] border-b border-[#273247]">
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
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-[#1B2332] text-[#6D8FFF] border border-[#273247] shadow-xs"
                    : "text-[#A0AEC0] hover:text-[#F1F5FC]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 bg-[#151B27]">
          {uploadError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          {sourceType === "document" && (
            <div className="space-y-3">
              {/* Direct File Upload Dropzone */}
              <div>
                <label className="text-xs font-medium text-[#A0AEC0] mb-1.5 block">
                  Upload File from Computer (PDF, DOCX, TXT, XLSX, CSV)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    uploadFile
                      ? "border-[#6D8FFF] bg-[#6D8FFF]/5"
                      : "border-[#273247] hover:border-[#6D8FFF]/50 bg-[#10141D]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.xlsx,.csv,.txt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <UploadCloud className="w-6 h-6 mx-auto mb-1.5 text-[#6D8FFF]" />
                  {uploadFile ? (
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-[#F1F5FC]">{uploadFile.name}</p>
                      <p className="text-[11px] text-[#A0AEC0]">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB • Ready to upload & attach
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-[#F1F5FC]">
                        Click or drag file here to upload
                      </p>
                      <p className="text-[11px] text-[#A0AEC0] mt-0.5">
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
                    <div className="flex-grow border-t border-[#273247]"></div>
                    <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-[#A0AEC0]">
                      OR CHOOSE EXISTING DOCUMENT
                    </span>
                    <div className="flex-grow border-t border-[#273247]"></div>
                  </div>
                  <select
                    value={selectedDocId}
                    onChange={(e) => {
                      setSelectedDocId(e.target.value);
                      if (e.target.value) setUploadFile(null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] focus:border-[#6D8FFF] outline-hidden mt-1"
                  >
                    <option value="">-- Choose from {workspaceDocuments.length} workspace documents --</option>
                    {workspaceDocuments.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title || doc.filename}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-[11px] text-[#A0AEC0] text-center italic">
                  Upload a file above to add your first document to this workspace.
                </p>
              )}
            </div>
          )}

          {(sourceType === "url" || sourceType === "youtube") && (
            <div>
              <label className="text-xs font-medium text-[#A0AEC0] mb-1.5 block">
                {sourceType === "youtube" ? "YouTube Video URL" : "Web Page URL"}
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={sourceType === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://..."}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] focus:border-[#6D8FFF] outline-hidden"
              />
            </div>
          )}

          {sourceType === "text" && (
            <div>
              <label className="text-xs font-medium text-[#A0AEC0] mb-1.5 block">
                Pasted Notes or Text
              </label>
              <textarea
                required
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste research excerpts, meeting transcripts, or markdown..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] focus:border-[#6D8FFF] outline-hidden resize-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[#A0AEC0] mb-1.5 block">
              Source Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Custom source display name..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-xs text-[#F1F5FC] focus:border-[#6D8FFF] outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#273247]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#273247] text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#0B0D12] border-t-transparent rounded-full animate-spin" />
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
