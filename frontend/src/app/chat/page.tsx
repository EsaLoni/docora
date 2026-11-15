"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Send,
  Sparkles,
  FileText,
  ChevronRight,
  BookOpen,
  StopCircle,
  Copy,
  Check,
  FolderOpen,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentDetailModal, DocumentItem } from "@/components/documents/DocumentDetailModal";
import { FormattedMessage, CitationItem } from "@/components/chat/FormattedMessage";
import { useAuth } from "@/context/AuthContext";

interface ChatMessage {
  id: string;
  sender_type: "user" | "assistant";
  content: string;
  created_at: string;
  citations?: CitationItem[];
  isStreaming?: boolean;
}

interface ConversationItem {
  id: string;
  title: string;
  updated_at: string;
  active_document_ids?: string[];
}

const DEFAULT_DOCUMENTS: DocumentItem[] = [
  {
    id: "doc-1",
    title: "Q3 2026 Earnings Report",
    filename: "q3_2026_earnings.pdf",
    file_size_bytes: 2_450_000,
    mime_type: "application/pdf",
    status: "READY",
    folder_id: "f-finance",
    page_count: 18,
    created_at: new Date(Date.now() - 3600 * 1000 * 24 * 2).toISOString(),
  },
  {
    id: "doc-2",
    title: "Master Services Agreement (MSA)",
    filename: "enterprise_msa_v2.docx",
    file_size_bytes: 840_000,
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    status: "READY",
    folder_id: "f-legal",
    page_count: 12,
    created_at: new Date(Date.now() - 3600 * 1000 * 24 * 4).toISOString(),
  },
  {
    id: "doc-3",
    title: "System Architecture Roadmap",
    filename: "udip_architecture_2026.pdf",
    file_size_bytes: 1_200_000,
    mime_type: "application/pdf",
    status: "READY",
    folder_id: "f-specs",
    page_count: 8,
    created_at: new Date(Date.now() - 3600 * 1000 * 12).toISOString(),
  },
];

const INITIAL_CONVERSATIONS: ConversationItem[] = [];

const INITIAL_MESSAGES: Record<string, ChatMessage[]> = {};

function ChatComponent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const docParam = searchParams.get("doc");

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>("");
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [inputQuery, setInputQuery] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [retrievalMode, setRetrievalMode] = useState<"hybrid" | "vector" | "keyword">("hybrid");
  const [selectedDocId, setSelectedDocId] = useState<string>("all");
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // Inspector modal state
  const [inspectDoc, setInspectDoc] = useState<DocumentItem | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isValidUUID = (id?: string | null) =>
    !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  // Fetch real documents and real conversations from backend
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [docsRes, convsRes] = await Promise.all([
          fetch("http://localhost:8000/api/v1/documents", {
            headers: { "x-dev-user-email": "dev@udip.local" },
          }),
          fetch("http://localhost:8000/api/v1/chat/conversations", {
            headers: { "x-dev-user-email": "dev@udip.local" },
          }),
        ]);

        if (docsRes.ok) {
          const docsData = await docsRes.json();
          if (docsData.items && docsData.items.length > 0) {
            setDocuments(docsData.items);
          }
        }

        if (convsRes.ok) {
          const convList = await convsRes.json();
          if (Array.isArray(convList) && convList.length > 0) {
            setConversations(convList);
            setActiveConvId(convList[0].id);
          } else {
            // Create initial conversation in backend
            const createRes = await fetch("http://localhost:8000/api/v1/chat/conversations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-dev-user-email": "dev@udip.local",
              },
              body: JSON.stringify({
                title: "General Discussion",
                active_document_ids: [],
              }),
            });
            if (createRes.ok) {
              const newConv = await createRes.json();
              setConversations([newConv]);
              setActiveConvId(newConv.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load initial chat data", err);
      }
    }
    loadInitialData();
  }, []);

  // Load messages whenever active conversation changes
  useEffect(() => {
    async function loadActiveMessages() {
      if (!isValidUUID(activeConvId)) return;
      try {
        const res = await fetch(`http://localhost:8000/api/v1/chat/conversations/${activeConvId}`, {
          headers: { "x-dev-user-email": "dev@udip.local" },
        });
        if (res.ok) {
          const detail = await res.json();
          if (detail.messages) {
            setMessages((prev) => ({
              ...prev,
              [activeConvId]: detail.messages.map((m: any) => ({
                id: m.id,
                sender_type: m.sender_type,
                content: m.content,
                created_at: m.created_at,
                citations: m.citations || [],
              })),
            }));
          }
        }
      } catch (err) {
        console.error("Failed to load conversation messages", err);
      }
    }
    loadActiveMessages();
  }, [activeConvId]);

  // Pre-select document if URL has ?doc=...
  useEffect(() => {
    if (docParam) {
      setSelectedDocId(docParam);
      async function createDocConv() {
        const doc = documents.find((d) => d.id === docParam);
        try {
          const res = await fetch("http://localhost:8000/api/v1/chat/conversations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-dev-user-email": "dev@udip.local",
            },
            body: JSON.stringify({
              title: doc ? `Discussion: ${doc.title}` : "Document Discussion",
              active_document_ids: isValidUUID(docParam) ? [docParam] : [],
            }),
          });
          if (res.ok) {
            const newConv = await res.json();
            setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
            setActiveConvId(newConv.id);
            setMessages((prev) => ({ ...prev, [newConv.id]: [] }));
          }
        } catch (err) {
          console.error("Failed to create doc conversation", err);
        }
      }
      createDocConv();
    }
  }, [docParam, documents]);

  const activeConv = conversations.find((c) => c.id === activeConvId);
  const currentMessages = messages[activeConvId] || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, isGenerating]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/chat/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          title: "New Conversation",
          active_document_ids: isValidUUID(selectedDocId) ? [selectedDocId] : [],
        }),
      });
      if (res.ok) {
        const newConv = await res.json();
        setConversations((prev) => [newConv, ...prev]);
        setActiveConvId(newConv.id);
        setMessages((prev) => ({ ...prev, [newConv.id]: [] }));
      }
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isValidUUID(id)) {
        await fetch(`http://localhost:8000/api/v1/chat/conversations/${id}`, {
          method: "DELETE",
          headers: { "x-dev-user-email": "dev@udip.local" },
        });
      }
      const filtered = conversations.filter((c) => c.id !== id);
      setConversations(filtered);
      if (activeConvId === id && filtered.length > 0) {
        setActiveConvId(filtered[0].id);
      }
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  // Rename conversation
  const handleRenameConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = conversations.find((c) => c.id === id);
    const newTitle = prompt("Enter conversation title:", current?.title);
    if (newTitle && newTitle.trim()) {
      try {
        if (isValidUUID(id)) {
          await fetch(`http://localhost:8000/api/v1/chat/conversations/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-dev-user-email": "dev@udip.local",
            },
            body: JSON.stringify({ title: newTitle.trim() }),
          });
        }
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim(), updated_at: new Date().toISOString() } : c))
        );
      } catch (err) {
        console.error("Failed to rename conversation", err);
      }
    }
  };

  // Send question and get answer
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputQuery.trim();
    if (!query || isGenerating) return;

    let targetConvId = activeConvId;

    // Ensure conversation exists in backend with a real UUID
    if (!isValidUUID(targetConvId)) {
      try {
        const createRes = await fetch("http://localhost:8000/api/v1/chat/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-dev-user-email": "dev@udip.local",
          },
          body: JSON.stringify({
            title: query.slice(0, 36) || "New Discussion",
            active_document_ids: isValidUUID(selectedDocId) ? [selectedDocId] : [],
          }),
        });
        if (createRes.ok) {
          const newConv = await createRes.json();
          targetConvId = newConv.id;
          setActiveConvId(targetConvId);
          setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== activeConvId)]);
        }
      } catch (err) {
        console.error("Failed to create conversation for message", err);
      }
    }

    const userMsgId = `usr-${Date.now()}`;
    const assistantMsgId = `ast-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender_type: "user",
      content: query,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), userMsg],
    }));

    setInputQuery("");
    setIsGenerating(true);

    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender_type: "assistant",
      content: "",
      created_at: new Date().toISOString(),
      isStreaming: true,
      citations: [],
    };

    setMessages((prev) => ({
      ...prev,
      [targetConvId]: [...(prev[targetConvId] || []), assistantMsg],
    }));

    try {
      const docIds = isValidUUID(selectedDocId) ? [selectedDocId] : null;
      const res = await fetch(`http://localhost:8000/api/v1/chat/conversations/${targetConvId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": "dev@udip.local",
        },
        body: JSON.stringify({
          question: query,
          retrieval_mode: retrievalMode,
          selected_document_ids: docIds,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => ({
          ...prev,
          [targetConvId]: (prev[targetConvId] || []).map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content: data.answer,
                  citations: data.citations || [],
                  isStreaming: false,
                }
              : m
          ),
        }));
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || errJson?.detail || `Server responded with ${res.status}`);
      }
    } catch (err: any) {
      setMessages((prev) => ({
        ...prev,
        [targetConvId]: (prev[targetConvId] || []).map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `Unable to get answer from AI: ${err?.message || "Communication error with backend"}. Please verify backend server status.`,
                isStreaming: false,
                citations: [],
              }
            : m
        ),
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleOpenCitation = (cite: CitationItem) => {
    const doc = documents.find((d) => d.id === cite.document_id) || {
      id: cite.document_id,
      title: cite.document_filename,
      filename: cite.document_filename,
      file_size_bytes: 1_200_000,
      mime_type: "application/pdf",
      status: "READY" as const,
      folder_id: null,
      page_count: Math.max(cite.page_number, 5),
      created_at: new Date().toISOString(),
    };
    setInspectDoc(doc);
    setIsInspectOpen(true);
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* 1. Left Sidebar: Conversations */}
      <div className="w-64 border-r bg-card/40 flex flex-col shrink-0">
        <div className="p-3 border-b space-y-2">
          <button
            onClick={handleNewConversation}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            New Thread
          </button>

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-background text-xs text-muted-foreground focus-within:ring-1 focus-within:ring-primary">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search threads..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-foreground placeholder:text-muted-foreground text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "group flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{conv.title}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleRenameConversation(conv.id, e)}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground"
                    title="Rename"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="p-1 rounded hover:bg-background text-muted-foreground hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {filteredConversations.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No threads found.
            </div>
          )}
        </div>

        <div className="p-3 border-t text-[11px] text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          <span>Grounded RAG &bull; Verified Citations</span>
        </div>
      </div>

      {/* 2. Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Chat Header */}
        <div className="h-14 border-b px-6 flex items-center justify-between bg-card/20 backdrop-blur-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <h2 className="text-sm font-semibold text-foreground truncate">
              {activeConv?.title || "Ask Docora"}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Scope Pill */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border rounded-lg px-2.5 py-1">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="bg-transparent text-xs text-foreground outline-none font-medium cursor-pointer"
              >
                <option value="all">All Documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || doc.filename}
                  </option>
                ))}
              </select>
            </div>

            {/* Retrieval Mode Quiet Popover */}
            <div className="relative">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs text-muted-foreground hover:text-foreground transition-colors",
                  showOptions && "bg-muted text-foreground"
                )}
                title="Retrieval Options"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span className="capitalize">{retrievalMode}</span>
              </button>

              {showOptions && (
                <div className="absolute right-0 mt-1.5 w-48 bg-card border rounded-xl shadow-lg p-2 z-20 space-y-1">
                  <div className="px-2 py-1 text-[10px] uppercase font-semibold text-muted-foreground">
                    Retrieval Mode
                  </div>
                  {(["hybrid", "vector", "keyword"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setRetrievalMode(m);
                        setShowOptions(false);
                      }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md text-xs font-medium flex items-center justify-between",
                        retrievalMode === m
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <span className="capitalize">{m === "hybrid" ? "Hybrid RRF" : m}</span>
                      {retrievalMode === m && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {currentMessages.length === 0 && (
            <div className="max-w-xl mx-auto my-10 sm:my-16 text-center space-y-6">
              <div className="relative inline-flex items-center justify-center">
                <div className="absolute -inset-1 rounded-2xl bg-linear-to-r from-blue-600/30 to-indigo-600/30 blur-md opacity-70 animate-pulse" />
                <div className="relative h-12 w-12 rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
                  <Sparkles className="h-6 w-6" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Ask Docora Intelligence
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Every answer is strictly grounded in your verified documents with exact page citations and zero hallucination.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                {[
                  "What is the roadmap and timeline for a Data Analyst?",
                  "Summarize key responsibilities and qualifications in this document.",
                  "What are the main findings, dates, or milestones mentioned?",
                  "Which section details technical skills and project tools?",
                ].map((promptText, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuery(promptText);
                      textareaRef.current?.focus();
                    }}
                    className="p-3.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 transition-all text-xs text-muted-foreground hover:text-foreground flex items-center justify-between group shadow-2xs hover:shadow-xs"
                  >
                    <span className="line-clamp-2 leading-relaxed">{promptText}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentMessages.map((msg) => {
            const isUser = msg.sender_type === "user";
            return (
              <div
                key={msg.id}
                className={cn(
                  "w-full flex",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                {isUser ? (
                  /* User Message */
                  <div className="flex items-start justify-end gap-2.5 max-w-2xl ml-auto">
                    <div className="rounded-2xl rounded-tr-xs px-4 py-3 bg-primary text-primary-foreground text-xs leading-relaxed shadow-xs">
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-[10.5px] font-bold shrink-0 mt-0.5 select-none">
                      {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "D"}
                    </div>
                  </div>
                ) : (
                  /* Assistant Message */
                  <div className="flex items-start gap-3.5 max-w-3xl mr-auto w-full group">
                    <div className="h-8 w-8 rounded-xl bg-linear-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 ring-2 ring-background">
                      <Sparkles className="h-4 w-4" />
                    </div>

                    <div className="flex-1 space-y-2.5 min-w-0">
                      {/* Assistant Header & Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground tracking-tight">
                            Docora Intelligence
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Grounded
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline-block">
                            Gemini 3.5 Flash
                          </span>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            title="Copy response"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span className="text-emerald-600 font-medium">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Formatted Markdown Body Card */}
                      <div className="rounded-2xl rounded-tl-xs p-4 sm:p-5 bg-card/60 backdrop-blur-xs border border-border/80 shadow-2xs">
                        <FormattedMessage
                          content={msg.content}
                          citations={msg.citations}
                          onOpenCitation={handleOpenCitation}
                        />
                        {msg.isStreaming && (
                          <span className="inline-block h-3.5 w-1.5 bg-primary ml-1 animate-pulse" />
                        )}
                      </div>

                      {/* Source Citations Tray */}
                      {msg.citations && msg.citations.length > 0 && (
                        <div className="space-y-1.5 pt-0.5 pl-0.5">
                          <div className="flex items-center gap-1.5 text-[10.5px] uppercase font-semibold tracking-wider text-muted-foreground">
                            <BookOpen className="w-3 h-3 text-primary" />
                            <span>Verified Sources ({msg.citations.length})</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {msg.citations.map((cite, cIdx) => (
                              <div
                                key={cite.id || cIdx}
                                onClick={() => handleOpenCitation(cite)}
                                className="group/card flex items-start gap-2.5 p-2.5 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-primary/40 cursor-pointer transition-all shadow-2xs hover:shadow-xs"
                                title="Click to view cited page in document viewer"
                              >
                                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-[10.5px]">
                                  {cIdx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-medium text-foreground truncate group-hover/card:text-primary transition-colors">
                                    {cite.document_filename}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground flex items-center justify-between mt-0.5">
                                    <span>Page {cite.page_number}</span>
                                    <span className="opacity-0 group-hover/card:opacity-100 transition-opacity text-primary inline-flex items-center gap-0.5 font-medium">
                                      View <ExternalLink className="w-2.5 h-2.5" />
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock (Floating Glassmorphism Composer) */}
        <div className="p-4 border-t bg-card/40 backdrop-blur-md">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto space-y-2">
            <div className="relative rounded-2xl border border-border/90 bg-background/90 backdrop-blur-xs p-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all shadow-xs">
              {/* Document Context Chip if selected */}
              {selectedDocId !== "all" && (
                <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-border/40 text-[11px] text-muted-foreground">
                  <span className="font-medium">Active Document:</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium border border-primary/20">
                    <FileText className="w-3 h-3" />
                    {documents.find((d) => d.id === selectedDocId)?.title ||
                      documents.find((d) => d.id === selectedDocId)?.filename ||
                      "Selected Document"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocId("all")}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear Filter
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                rows={1}
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder={
                  selectedDocId !== "all"
                    ? `Ask anything about ${documents.find((d) => d.id === selectedDocId)?.title || "this document"}...`
                    : "Ask Docora anything about your documents..."
                }
                className="w-full bg-transparent resize-none outline-none text-xs text-foreground placeholder:text-muted-foreground p-1 max-h-36 min-h-[2.5rem] leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/40">
                <div className="flex items-center gap-2">
                  {/* Scope Selector */}
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <FolderOpen className="h-3 w-3 text-muted-foreground" />
                    <select
                      value={selectedDocId}
                      onChange={(e) => setSelectedDocId(e.target.value)}
                      className="bg-transparent text-[11px] text-muted-foreground hover:text-foreground outline-none font-medium cursor-pointer"
                    >
                      <option value="all">All Documents</option>
                      {documents.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.title || doc.filename}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-border">|</span>

                  {/* Mode Badge */}
                  <span className="text-[10.5px] text-muted-foreground font-medium capitalize">
                    {retrievalMode} RAG
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline-block">
                    Press <kbd className="font-mono bg-muted/60 px-1 py-0.5 rounded text-[9.5px]">Enter</kbd> to send
                  </span>

                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={() => setIsGenerating(false)}
                      className="h-8 w-8 rounded-xl bg-red-600 text-white hover:bg-red-700 flex items-center justify-center transition-all shadow-2xs"
                      title="Stop Generating"
                    >
                      <StopCircle className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!inputQuery.trim()}
                      className={cn(
                        "h-8 w-8 rounded-xl flex items-center justify-center transition-all shadow-xs",
                        inputQuery.trim()
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                          : "bg-muted text-muted-foreground opacity-40 cursor-not-allowed"
                      )}
                      title="Send Message"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Citation Inspector Modal */}
      <DocumentDetailModal
        document={inspectDoc}
        isOpen={isInspectOpen}
        onClose={() => setIsInspectOpen(false)}
        onRetryProcessing={() => {}}
        onDownload={() => {}}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Loading Ask Docora...</div>}>
      <ChatComponent />
    </Suspense>
  );
}
