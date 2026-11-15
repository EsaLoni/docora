"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

export type UploadState =
  | "waiting"
  | "uploading"
  | "uploaded"
  | "processing"
  | "extracting"
  | "embedding"
  | "ready"
  | "failed";

export interface QueueItem {
  id: string;
  filename: string;
  fileSize: number;
  status: UploadState;
  progress: number;
  errorMessage?: string;
  documentId?: string;
  createdAt: string;
}

interface UploadContextType {
  queue: QueueItem[];
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  uploadFiles: (files: FileList | File[], folderId?: string | null) => Promise<void>;
  retryItem: (id: string) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  activeCount: number;
  subscribeToDocUpdates: (callback: () => void) => () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const fileCacheRef = useRef<Map<string, { file: File; folderId?: string | null }>>(new Map());
  const subscribersRef = useRef<Set<() => void>>(new Set());

  const subscribeToDocUpdates = useCallback((cb: () => void) => {
    subscribersRef.current.add(cb);
    return () => {
      subscribersRef.current.delete(cb);
    };
  }, []);

  const notifySubscribers = useCallback(() => {
    subscribersRef.current.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("Subscriber notification error", err);
      }
    });
  }, []);

  // Upload runner
  const processUploadItem = async (itemId: string) => {
    const cached = fileCacheRef.current.get(itemId);
    if (!cached) return;
    const { file, folderId } = cached;

    // 1. Client-side format & size validation
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
    const allowed = [".pdf", ".docx", ".xlsx", ".csv", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".tiff"];

    if (!allowed.includes(ext)) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "failed", errorMessage: `Unsupported format '${ext}'. Allowed: PDF, DOCX, XLSX, CSV, TXT.` }
            : item
        )
      );
      return;
    }

    if (file.size > 26_214_400) {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, status: "failed", errorMessage: "File exceeds 25 MB maximum upload limit." }
            : item
        )
      );
      return;
    }

    // Set uploading
    setQueue((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: "uploading", progress: 25 } : item))
    );

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
      if (folderId && folderId !== "all" && folderId !== "root") {
        formData.append("folder_id", folderId);
      }

      // Simulate partial progress update
      const progressTimer = setTimeout(() => {
        setQueue((prev) =>
          prev.map((item) => (item.id === itemId && item.status === "uploading" ? { ...item, progress: 65 } : item))
        );
      }, 300);

      const res = await fetch("http://localhost:8000/api/v1/documents/upload", {
        method: "POST",
        headers: { "x-dev-user-email": "dev@udip.local" },
        body: formData,
      });

      clearTimeout(progressTimer);

      if (res.ok) {
        const docData = await res.json();
        setQueue((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: "processing",
                  progress: 80,
                  documentId: docData.id,
                }
              : item
          )
        );
        notifySubscribers();
      } else {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.error?.message || errJson.detail || "Server rejected upload.";
        setQueue((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, status: "failed", errorMessage: msg } : item))
        );
      }
    } catch {
      setQueue((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, status: "failed", errorMessage: "Network or server connection failed." } : item
        )
      );
    }
  };

  const uploadFiles = async (fileList: FileList | File[], folderId?: string | null) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const newItems: QueueItem[] = [];
    for (const f of files) {
      const id = `upl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      fileCacheRef.current.set(id, { file: f, folderId });
      newItems.push({
        id,
        filename: f.name,
        fileSize: f.size,
        status: "waiting",
        progress: 0,
        createdAt: new Date().toISOString(),
      });
    }

    setQueue((prev) => [...newItems, ...prev]);
    setIsExpanded(true);

    // Kick off background processing for newly added items
    for (const item of newItems) {
      processUploadItem(item.id);
    }
  };

  const retryItem = (id: string) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: "waiting", progress: 0, errorMessage: undefined } : item))
    );
    processUploadItem(id);
  };

  const removeItem = (id: string) => {
    fileCacheRef.current.delete(id);
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue((prev) => {
      const remaining = prev.filter((item) => item.status !== "ready");
      // Clean cache
      const keepIds = new Set(remaining.map((r) => r.id));
      for (const key of fileCacheRef.current.keys()) {
        if (!keepIds.has(key)) fileCacheRef.current.delete(key);
      }
      return remaining;
    });
  };

  // Active polling worker: Polls documents in 'processing' or 'uploaded' status every 2 seconds
  useEffect(() => {
    const processingItems = queue.filter(
      (item) => item.documentId && (item.status === "processing" || item.status === "uploaded")
    );

    if (processingItems.length === 0) return;

    const pollInterval = setInterval(async () => {
      for (const item of processingItems) {
        if (!item.documentId) continue;
        try {
          const res = await fetch(`http://localhost:8000/api/v1/documents/${item.documentId}`, {
            headers: { "x-dev-user-email": "dev@udip.local" },
          });

          if (res.ok) {
            const data = await res.json();
            if (data.status === "READY") {
              setQueue((prev) =>
                prev.map((q) => (q.id === item.id ? { ...q, status: "ready", progress: 100 } : q))
              );
              notifySubscribers();
            } else if (data.status === "FAILED") {
              setQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id
                    ? {
                        ...q,
                        status: "failed",
                        errorMessage: data.processing_error || "Extraction processing failed.",
                      }
                    : q
                )
              );
              notifySubscribers();
            }
          }
        } catch {
          // Poll retry silently
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [queue, notifySubscribers]);

  const activeCount = queue.filter(
    (item) => item.status === "uploading" || item.status === "processing" || item.status === "waiting"
  ).length;

  return (
    <UploadContext.Provider
      value={{
        queue,
        isExpanded,
        setIsExpanded,
        uploadFiles,
        retryItem,
        removeItem,
        clearCompleted,
        activeCount,
        subscribeToDocUpdates,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error("useUpload must be used within an UploadProvider");
  }
  return context;
}
