"use client";

import { useState, useEffect, useCallback } from "react";
import {
  apiClient,
  SourceItem,
  NoteItem,
  ArtifactItem,
  NotebookDetail,
  DocumentItem,
  ChatMessage,
} from "@/lib/api-client";

export interface ToastNotification {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  message: string;
  diagnostic?: {
    endpoint?: string;
    status?: number | string;
    requestId?: string;
    timestamp?: string;
    detail?: string;
  };
}

export function useNotebook(notebookId: string) {
  const [notebook, setNotebook] = useState<NotebookDetail | null>(null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [workspaceDocuments, setWorkspaceDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [responseStyle, setResponseStyle] = useState("default");
  const [conversationId, setConversationId] = useState<string>("");

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback(
    (
      type: "success" | "error" | "info",
      title: string,
      message: string,
      diagnostic?: ToastNotification["diagnostic"]
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, type, title, message, diagnostic }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshNotebook = useCallback(async () => {
    if (!notebookId) return;
    try {
      const [nb, docs] = await Promise.all([
        apiClient.getNotebook(notebookId),
        apiClient.getDocuments().catch(() => ({ items: [], total: 0 })),
      ]);
      setNotebook(nb);
      if (nb.workspace_id) {
        apiClient.setWorkspaceId(nb.workspace_id);
      }
      setSources(nb.sources || []);
      setNotes(nb.notes || []);
      setArtifacts(nb.artifacts || []);
      setWorkspaceDocuments(docs.items || []);
    } catch (err: any) {
      console.error("Failed to load notebook data:", err);
      showToast("error", "Failed to Load Notebook", err.message || "Could not retrieve notebook data.");
    } finally {
      setLoading(false);
    }
  }, [notebookId, showToast]);

  useEffect(() => {
    refreshNotebook();
  }, [refreshNotebook]);

  // Rename Notebook Title
  const handleSaveTitle = async (newTitle: string) => {
    if (!newTitle.trim() || newTitle === notebook?.title) return;
    try {
      await apiClient.updateNotebookTitle(notebookId, newTitle.trim());
      setNotebook((prev) => (prev ? { ...prev, title: newTitle.trim() } : null));
      showToast("success", "Notebook Renamed", `Updated title to "${newTitle.trim()}"`);
    } catch (err: any) {
      showToast("error", "Rename Failed", err.message || "Failed to update notebook title");
    }
  };

  // Toggle Source Active
  const handleToggleSource = async (sourceId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, is_active_for_queries: nextStatus } : s))
    );
    try {
      await apiClient.toggleSourceActive(notebookId, sourceId, nextStatus);
    } catch (err: any) {
      // Revert on error
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, is_active_for_queries: currentStatus } : s))
      );
      showToast("error", "Source Toggle Failed", err.message);
    }
  };

  // Delete Source
  const handleDeleteSource = async (sourceId: string) => {
    try {
      await apiClient.deleteSource(notebookId, sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      showToast("success", "Source Removed", "Source was unlinked from this notebook.");
    } catch (err: any) {
      showToast("error", "Failed to Remove Source", err.message);
      throw err;
    }
  };

  // Add Source
  const handleAddSource = async (payload: {
    source_type: string;
    title: string;
    document_id?: string;
    url?: string;
    raw_content?: string;
  }) => {
    try {
      await apiClient.addSource(notebookId, payload);
      showToast("success", "Source Linked", `"${payload.title}" added to notebook.`);
      await refreshNotebook();
    } catch (err: any) {
      showToast("error", "Failed to Add Source", err.message);
      throw err;
    }
  };

  // Create Note
  const handleCreateNote = async (title: string, content: string) => {
    try {
      await apiClient.createNote(notebookId, {
        title: title.trim() || "Untitled Note",
        content: content.trim(),
      });
      showToast("success", "Note Created", "Your note has been saved to this notebook.");
      await refreshNotebook();
    } catch (err: any) {
      showToast("error", "Note Creation Failed", err.message);
      throw err;
    }
  };

  // Delete Note
  const handleDeleteNote = async (noteId: string) => {
    try {
      await apiClient.deleteNote(notebookId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      showToast("success", "Note Deleted", "The note was permanently removed.");
    } catch (err: any) {
      showToast("error", "Failed to Delete Note", err.message);
    }
  };

  // Save Message as Note
  const handleSaveAsNote = async (msg: ChatMessage) => {
    try {
      await apiClient.createNote(notebookId, {
        title: `Insight from Chat (${new Date().toLocaleDateString()})`,
        content: msg.content,
        source_citations: msg.citations || [],
      });
      showToast("success", "Saved to Notes", "Chat response was saved as a persistent note.");
      await refreshNotebook();
    } catch (err: any) {
      showToast("error", "Failed to Save Note", err.message);
    }
  };

  // Send Chat Message
  const handleSendMessage = async () => {
    if (!inputQuery.trim() || isGenerating) return;
    const q = inputQuery.trim();
    setInputQuery("");
    setIsGenerating(true);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender_type: "user",
      content: q,
      created_at: new Date().toISOString(),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender_type: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true,
      citations: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const activeDocIds = sources
      .filter((s) => s.is_active_for_queries)
      .map((s) => s.document_id || s.id);

    try {
      await apiClient.streamChat(
        notebookId,
        {
          message: q,
          conversation_id: conversationId || undefined,
          source_ids: activeDocIds.length > 0 ? activeDocIds : undefined,
          response_style: responseStyle,
        },
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m))
          );
        },
        (citations, convId) => {
          if (convId) setConversationId(convId);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, citations: citations || [], isStreaming: false }
                : m
            )
          );
        }
      );
    } catch (err: any) {
      console.error("Chat generation failed:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `Unable to complete request: ${err.message || "An unexpected error occurred."}`,
                isStreaming: false,
              }
            : m
        )
      );
      showToast("error", "Generation Error", err.message || "Failed to generate answer.");
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    notebook,
    sources,
    notes,
    artifacts,
    workspaceDocuments,
    loading,
    refreshNotebook,
    handleSaveTitle,
    handleToggleSource,
    handleDeleteSource,
    handleAddSource,
    handleCreateNote,
    handleDeleteNote,
    handleSaveAsNote,
    // Chat
    messages,
    inputQuery,
    setInputQuery,
    isGenerating,
    responseStyle,
    setResponseStyle,
    handleSendMessage,
    // Toasts
    toasts,
    showToast,
    removeToast,
  };
}
