/**
 * Shared Typed API Client for Docora — AI Document Intelligence Platform.
 *
 * Centralizes all network interactions, auth headers, error normalization,
 * and endpoint definitions. Replaces hardcoded localhost URLs across frontend.
 */

export interface PublicConfig {
  api_url: string;
  model_name: string;
  model_label: string;
  supported_languages: Array<{ code: string; name: string; native: string }>;
  limits: {
    max_upload_size_mb: number;
    max_sources_per_notebook: number;
    max_tokens_per_source: number;
    daily_quota_generations: number;
  };
  feature_flags: Record<string, boolean>;
}

export interface NotebookItem {
  id: string;
  title: string;
  description?: string;
  color?: string;
  icon?: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
}

export interface SourceItem {
  id: string;
  title: string;
  source_type: string;
  document_id?: string;
  url?: string;
  is_active_for_queries: boolean;
  extraction_status: string;
  token_count: number;
  metadata?: any;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  color?: string;
  is_pinned?: boolean;
  source_citations?: any[];
  updated_at?: string;
}

export interface ArtifactItem {
  id: string;
  notebook_id?: string;
  title: string;
  artifact_type: string;
  status: string;
  data: any;
  export_file_path?: string;
  generation_time_ms?: number;
  created_at: string;
}

export interface CitationItem {
  id?: string;
  document_id: string;
  document_filename: string;
  chunk_id: string;
  page_number: number;
  quote: string;
  relevance_score?: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_size_bytes?: number;
  file_type?: string;
  mime_type?: string;
  folder_id?: string | null;
  total_pages?: number;
  status?: string;
  processing_error?: string | null;
  created_at?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  color?: string;
  parent_id?: string | null;
  document_count?: number;
  created_at?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "dismissed";
  priority?: "low" | "medium" | "high" | "critical";
  due_date?: string | null;
  source_type?: string;
  document_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error" | "action";
  is_read: boolean;
  link_url?: string;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  notebook_id?: string | null;
  active_document_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  sender_type: "user" | "assistant";
  content: string;
  citations?: CitationItem[];
  created_at: string;
  isStreaming?: boolean;
}

export interface NotebookDetail extends NotebookItem {
  sources: SourceItem[];
  notes: NoteItem[];
  artifacts: ArtifactItem[];
}

export interface UserWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string;
  is_owner: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  avatar_url?: string | null;
  workspaces: UserWorkspace[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user: UserProfile;
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  detail?: string;
  endpoint?: string;
  requestId?: string;
}

/**
 * Resolves the backend API base URL with production safety guards.
 * Normalizes any trailing /api/v1 suffix so that endpoint paths can be
 * appended cleanly without duplicate segments.
 */
export function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (raw) {
    let normalized = raw.replace(/\/api\/v1\/?$/, "");
    if (normalized.endsWith("/")) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  // Safe fallback in production: never route browser traffic to localhost
  if (process.env.NODE_ENV === "production") {
    if (typeof window !== "undefined") {
      console.warn(
        "Docora API Warning: NEXT_PUBLIC_API_URL is not configured in production. Defaulting to relative origin."
      );
    }
    return "";
  }

  // Local development fallback
  return "http://localhost:8000";
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private token: string | null = null;

  constructor() {
    this.baseUrl = resolveApiBaseUrl();
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "x-dev-user-email": "dev@udip.local",
    };

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("udip_access_token");
        if (saved) {
          this.setAuthToken(saved);
        }
        const savedGeminiKey = localStorage.getItem("docora_user_gemini_key");
        if (savedGeminiKey) {
          this.defaultHeaders["X-Gemini-API-Key"] = savedGeminiKey.trim();
        }
      } catch {
        // localStorage unavailable
      }
    }
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  buildUrl(endpoint: string): string {
    const cleanPath = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanPath}`;
  }

  setAuthToken(token: string | null) {
    this.token = token;
    if (token) {
      this.defaultHeaders["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.defaultHeaders["Authorization"];
    }
  }

  setGeminiApiKey(apiKey: string | null) {
    if (apiKey && apiKey.trim()) {
      this.defaultHeaders["X-Gemini-API-Key"] = apiKey.trim();
      if (typeof window !== "undefined") {
        localStorage.setItem("docora_user_gemini_key", apiKey.trim());
      }
    } else {
      delete this.defaultHeaders["X-Gemini-API-Key"];
      if (typeof window !== "undefined") {
        localStorage.removeItem("docora_user_gemini_key");
      }
    }
  }

  getGeminiApiKey(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("docora_user_gemini_key") || this.defaultHeaders["X-Gemini-API-Key"] || null;
    }
    return this.defaultHeaders["X-Gemini-API-Key"] || null;
  }

  getAuthToken(): string | null {
    return this.token;
  }

  /**
   * Low-level fetch wrapper that attaches base URL, credentials, auth, and CSRF token.
   * Useful for SSE streaming, Blob/PDF downloads, and raw multipart requests.
   */
  async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = this.buildUrl(endpoint);
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...((options.headers as Record<string, string>) || {}),
    };

    // If body is FormData, delete Content-Type to allow browser boundary calculation
    if (typeof FormData !== "undefined" && options.body instanceof FormData) {
      delete headers["Content-Type"];
    }

    // Attach CSRF token from document cookie if running in browser
    if (typeof document !== "undefined") {
      const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
      if (csrfMatch && csrfMatch[1]) {
        headers["X-CSRF-Token"] = decodeURIComponent(csrfMatch[1]);
      }
    }

    const token =
      this.token || (typeof window !== "undefined" ? localStorage.getItem("udip_access_token") : null);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const geminiKey =
      this.defaultHeaders["X-Gemini-API-Key"] ||
      (typeof window !== "undefined" ? localStorage.getItem("docora_user_gemini_key") : null);
    if (geminiKey) {
      headers["X-Gemini-API-Key"] = geminiKey.trim();
    }

    return fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });
  }

  /**
   * Standard JSON request handler with normalized error wrapping.
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let res: Response;
    try {
      res = await this.fetch(endpoint, options);
    } catch (err: any) {
      throw {
        message: err.message || "Network connection failed",
        status: 0,
        endpoint,
      } as ApiError;
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const error: ApiError = {
        message:
          errJson.detail ||
          errJson.error?.message ||
          `Server responded with ${res.status}`,
        code: errJson.error?.code,
        status: res.status,
        detail: errJson.detail || errJson.error?.message,
        endpoint,
        requestId: res.headers.get("x-request-id") || undefined,
      };
      throw error;
    }

    if (res.status === 204) {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body:
        body !== undefined && !(typeof FormData !== "undefined" && body instanceof FormData)
          ? JSON.stringify(body)
          : body,
    });
  }

  async patch<T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body:
        body !== undefined && !(typeof FormData !== "undefined" && body instanceof FormData)
          ? JSON.stringify(body)
          : body,
    });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  async register(payload: { email: string; password: string; full_name?: string }): Promise<AuthResponse> {
    const res = await this.post<AuthResponse>("/api/v1/auth/register", payload);
    if (res.access_token) {
      this.setAuthToken(res.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("udip_access_token", res.access_token);
      }
    }
    return res;
  }

  async login(payload: { email: string; password: string; remember_me?: boolean }): Promise<AuthResponse> {
    const res = await this.post<AuthResponse>("/api/v1/auth/login", payload);
    if (res.access_token) {
      this.setAuthToken(res.access_token);
      if (typeof window !== "undefined") {
        localStorage.setItem("udip_access_token", res.access_token);
      }
    }
    return res;
  }

  async logout(): Promise<{ success: boolean }> {
    try {
      await this.post<{ success: boolean }>("/api/v1/auth/logout");
    } finally {
      this.setAuthToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("udip_access_token");
      }
    }
    return { success: true };
  }

  async getMe(): Promise<UserProfile> {
    return this.get<UserProfile>("/api/v1/auth/me");
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; reset_token?: string }> {
    return this.post<{ success: boolean; message: string; reset_token?: string }>(
      "/api/v1/auth/forgot-password",
      { email }
    );
  }

  async resetPassword(payload: { token: string; new_password: string }): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>("/api/v1/auth/reset-password", payload);
  }

  // ---------------------------------------------------------------------------
  // Configuration & System
  // ---------------------------------------------------------------------------
  async getPublicConfig(): Promise<PublicConfig> {
    return this.get<PublicConfig>("/api/v1/config/public");
  }

  async checkHealth(): Promise<{ status: string }> {
    return this.request<{ status: string }>("/api/v1/health", { cache: "no-store" });
  }

  // ---------------------------------------------------------------------------
  // Notebooks
  // ---------------------------------------------------------------------------
  async listNotebooks(): Promise<NotebookItem[]> {
    return this.get<NotebookItem[]>("/api/v1/notebooks");
  }

  async createNotebook(payload: { title: string; description?: string | null; color?: string }): Promise<NotebookItem> {
    return this.post<NotebookItem>("/api/v1/notebooks", payload);
  }

  async deleteNotebook(notebookId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/api/v1/notebooks/${notebookId}`);
  }

  async getNotebook(notebookId: string): Promise<NotebookDetail> {
    return this.get<NotebookDetail>(`/api/v1/notebooks/${notebookId}`);
  }

  async updateNotebookTitle(notebookId: string, title: string): Promise<NotebookItem> {
    return this.patch<NotebookItem>(`/api/v1/notebooks/${notebookId}`, { title });
  }

  // ---------------------------------------------------------------------------
  // Sources
  // ---------------------------------------------------------------------------
  async getNotebookSources(notebookId: string): Promise<SourceItem[]> {
    return this.get<SourceItem[]>(`/api/v1/notebooks/${notebookId}/sources`);
  }

  async addSource(notebookId: string, payload: any): Promise<SourceItem> {
    return this.post<SourceItem>(`/api/v1/notebooks/${notebookId}/sources`, payload);
  }

  async deleteSource(notebookId: string, sourceId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/api/v1/notebooks/${notebookId}/sources/${sourceId}`);
  }

  async toggleSourceActive(
    notebookId: string,
    sourceId: string,
    isActive: boolean
  ): Promise<{ success: boolean }> {
    return this.patch<{ success: boolean }>(`/api/v1/notebooks/${notebookId}/sources/${sourceId}`, {
      is_active_for_queries: isActive,
    });
  }

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------
  async getNotebookNotes(notebookId: string): Promise<NoteItem[]> {
    return this.get<NoteItem[]>(`/api/v1/notebooks/${notebookId}/notes`);
  }

  async createNote(
    notebookId: string,
    payload: { title: string; content: string; color?: string; source_citations?: any[] }
  ): Promise<NoteItem> {
    return this.post<NoteItem>(`/api/v1/notebooks/${notebookId}/notes`, payload);
  }

  async deleteNote(notebookId: string, noteId: string): Promise<{ success: boolean }> {
    return this.delete<{ success: boolean }>(`/api/v1/notebooks/${notebookId}/notes/${noteId}`);
  }

  // ---------------------------------------------------------------------------
  // Artifacts & Studio
  // ---------------------------------------------------------------------------
  async getNotebookArtifacts(notebookId: string): Promise<ArtifactItem[]> {
    return this.get<ArtifactItem[]>(`/api/v1/notebooks/${notebookId}/artifacts`);
  }

  async generateStudioArtifact(notebookId: string, tool: string, payload: any): Promise<ArtifactItem> {
    return this.post<ArtifactItem>(`/api/v1/notebooks/${notebookId}/studio/${tool}`, payload);
  }

  // ---------------------------------------------------------------------------
  // Documents & Folders
  // ---------------------------------------------------------------------------
  async getDocuments(limit: number = 100, page: number = 1): Promise<{ items: DocumentItem[]; total: number }> {
    const res = await this.get<{ items: DocumentItem[]; total: number }>(
      `/api/v1/documents?limit=${limit}&page_size=${limit}&page=${page}`
    );
    return res || { items: [], total: 0 };
  }

  async getDocument(documentId: string): Promise<DocumentItem> {
    return this.get<DocumentItem>(`/api/v1/documents/${documentId}`);
  }

  async deleteDocument(documentId: string): Promise<{ success: boolean }> {
    await this.delete(`/api/v1/documents/${documentId}`);
    return { success: true };
  }

  async updateDocument(documentId: string, payload: { folder_id?: string | null; title?: string }): Promise<DocumentItem> {
    return this.patch<DocumentItem>(`/api/v1/documents/${documentId}`, payload);
  }

  async listFolders(): Promise<FolderItem[]> {
    const res = await this.get<any>("/api/v1/folders");
    if (Array.isArray(res)) return res;
    if (res?.items && Array.isArray(res.items)) return res.items;
    return [];
  }

  async createFolder(payload: { name: string; color?: string; parent_id?: string | null }): Promise<FolderItem> {
    return this.post<FolderItem>("/api/v1/folders", payload);
  }

  async uploadDocument(file: File, folderId?: string | null): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name.replace(/\.[^/.]+$/, ""));
    if (folderId && folderId !== "all" && folderId !== "root") {
      formData.append("folder_id", folderId);
    }

    const res = await this.fetch("/api/v1/documents/upload", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || errJson.error?.message || `Upload failed with HTTP ${res.status}`);
    }

    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Chat & Conversations
  // ---------------------------------------------------------------------------
  async listConversations(): Promise<ConversationItem[]> {
    const res = await this.get<ConversationItem[]>("/api/v1/chat/conversations");
    return Array.isArray(res) ? res : [];
  }

  async createConversation(payload: { title: string; active_document_ids?: string[]; notebook_id?: string }): Promise<ConversationItem> {
    return this.post<ConversationItem>("/api/v1/chat/conversations", payload);
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.get<any>(`/api/v1/chat/conversations/${conversationId}`);
  }

  async updateConversation(conversationId: string, payload: { title: string }): Promise<ConversationItem> {
    return this.patch<ConversationItem>(`/api/v1/chat/conversations/${conversationId}`, payload);
  }

  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    await this.delete(`/api/v1/chat/conversations/${conversationId}`);
    return { success: true };
  }

  async sendConversationMessage(
    conversationId: string,
    payload: {
      question: string;
      retrieval_mode?: string;
      selected_document_ids?: string[] | null;
      stream?: boolean;
    }
  ): Promise<any> {
    return this.post<any>(`/api/v1/chat/conversations/${conversationId}/messages`, payload);
  }

  // ---------------------------------------------------------------------------
  // Intelligence Operations
  // ---------------------------------------------------------------------------
  async summarizeDocument(payload: { document_id: string; summary_type: string; custom_instruction?: string }): Promise<any> {
    return this.post<any>("/api/v1/intelligence/summarize", payload);
  }

  async compareDocuments(payload: { document_ids: string[]; comparison_type: string; custom_prompt?: string }): Promise<any> {
    return this.post<any>("/api/v1/intelligence/compare", payload);
  }

  async extractDocumentData(payload: { document_id: string; template: string; custom_fields?: string[] }): Promise<any> {
    return this.post<any>("/api/v1/intelligence/extract", payload);
  }

  async generateInsights(payload: { document_id: string }): Promise<any> {
    return this.post<any>("/api/v1/intelligence/insights", payload);
  }

  async exportArtifact(payload: { export_type: string; format: string; payload: any }): Promise<Blob> {
    const res = await this.fetch("/api/v1/intelligence/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to export artifact");
    return res.blob();
  }

  // ---------------------------------------------------------------------------
  // Tasks, Actions, Reminders
  // ---------------------------------------------------------------------------
  async listActions(): Promise<{ items: ActionItem[] }> {
    const res = await this.get<any>("/api/v1/actions");
    if (Array.isArray(res)) return { items: res };
    return res || { items: [] };
  }

  async listActionSuggestions(): Promise<{ items: any[] }> {
    const res = await this.get<any>("/api/v1/actions/suggestions");
    if (Array.isArray(res)) return { items: res };
    return res || { items: [] };
  }

  async listReminders(): Promise<{ items: any[] }> {
    const res = await this.get<any>("/api/v1/reminders");
    if (Array.isArray(res)) return { items: res };
    return res || { items: [] };
  }

  async createAction(payload: { title: string; priority?: string; due_date?: string }): Promise<ActionItem> {
    return this.post<ActionItem>("/api/v1/actions", payload);
  }

  async deleteAction(actionId: string): Promise<void> {
    await this.delete(`/api/v1/actions/${actionId}`);
  }

  async completeAction(actionId: string): Promise<ActionItem> {
    return this.post<ActionItem>(`/api/v1/actions/${actionId}/complete`);
  }

  async reopenAction(actionId: string): Promise<ActionItem> {
    return this.post<ActionItem>(`/api/v1/actions/${actionId}/reopen`);
  }

  async approveActionSuggestion(suggestionId: string, payload?: { priority?: string }): Promise<any> {
    return this.post<any>(`/api/v1/actions/suggestions/${suggestionId}/approve`, payload || { priority: "high" });
  }

  async dismissActionSuggestion(suggestionId: string): Promise<any> {
    return this.post<any>(`/api/v1/actions/suggestions/${suggestionId}/dismiss`);
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  async listNotifications(limit: number = 10): Promise<{ items: InAppNotification[]; unread_count: number }> {
    const res = await this.get<any>(`/api/v1/notifications?limit=${limit}`);
    return {
      items: res?.items || (Array.isArray(res) ? res : []),
      unread_count: res?.unread_count ?? (Array.isArray(res) ? res.filter((n: any) => !n.is_read).length : 0),
    };
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.post<any>(`/api/v1/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<any> {
    return this.post<any>("/api/v1/notifications/read-all");
  }

  // ---------------------------------------------------------------------------
  // Stream Chat
  // ---------------------------------------------------------------------------
  async streamChat(
    notebookId: string,
    payload: {
      message: string;
      conversation_id?: string;
      source_ids?: string[];
      response_style?: string;
    },
    onToken: (token: string) => void,
    onComplete: (citations: CitationItem[], convId?: string) => void
  ): Promise<void> {
    let convId = payload.conversation_id;
    if (!convId) {
      const conv = await this.post<{ id: string }>("/api/v1/chat/conversations", {
        title: payload.message.slice(0, 40),
        notebook_id: notebookId,
        document_ids: payload.source_ids,
      });
      convId = conv.id;
    }

    const res = await this.fetch(`/api/v1/chat/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        question: payload.message,
        content: payload.message,
        selected_document_ids: payload.source_ids,
        stream: true,
        options: { response_style: payload.response_style },
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw {
        message: errJson.detail || errJson.error?.message || `HTTP ${res.status}`,
        status: res.status,
      } as ApiError;
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.token || (parsed.type === "chunk" && parsed.text)) {
                  onToken(parsed.token || parsed.text || "");
                } else if (parsed.citations || (parsed.type === "complete" && parsed.citations)) {
                  onComplete(parsed.citations, convId);
                }
              } catch {
                const raw = trimmed.slice(6);
                if (raw && !raw.startsWith("{")) onToken(raw);
              }
            }
          }
        }
      }
    } else {
      const data = await res.json();
      onToken(data.answer || data.content || "");
      onComplete(data.citations || [], convId);
    }
  }
}

export const apiClient = new ApiClient();
