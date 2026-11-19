"use client";

import React, { useState, useEffect } from "react";
import {
  CheckSquare,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/api-client";

interface ActionItem {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  due_date?: string;
  source_evidence_quote?: string;
  page_number?: number;
  created_at: string;
}

interface ActionSuggestion {
  id: string;
  document_id: string;
  title: string;
  description?: string;
  proposed_due_date?: string;
  category: string;
  evidence_text: string;
  confidence_score: number;
  page_number: number;
  is_approved: boolean;
  is_dismissed: boolean;
}

interface ReminderItem {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  status: "scheduled" | "sent" | "snoozed" | "cancelled";
  snooze_until?: string;
  created_at: string;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"actions" | "suggestions" | "reminders">("actions");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New item modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [actRes, sugRes, remRes] = await Promise.all([
        apiClient.listActions().catch(() => ({ items: [] })),
        apiClient.listActionSuggestions().catch(() => ({ items: [] })),
        apiClient.listReminders().catch(() => ({ items: [] })),
      ]);

      setActions((actRes.items as any) || []);
      setSuggestions(sugRes.items || []);
      setReminders(remRes.items || []);
    } catch {
      // Retain existing state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.email]);

  const handleToggleComplete = async (action: ActionItem) => {
    const isCompleted = action.status === "completed";
    try {
      if (isCompleted) {
        await apiClient.reopenAction(action.id);
      } else {
        await apiClient.completeAction(action.id);
      }
      fetchData();
    } catch {
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: isCompleted ? "pending" : "completed" } : a))
      );
    }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      await apiClient.deleteAction(id);
      fetchData();
    } catch {
      setActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleApproveSuggestion = async (sugId: string) => {
    try {
      await apiClient.approveActionSuggestion(sugId, { priority: "high" });
      fetchData();
    } catch {
      // Fallback
    }
  };

  const handleDismissSuggestion = async (sugId: string) => {
    try {
      await apiClient.dismissActionSuggestion(sugId);
      fetchData();
    } catch {
      // Fallback
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await apiClient.createAction({
        title: newTitle.trim(),
        priority: newPriority,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      });
      setNewTitle("");
      setNewDueDate("");
      setIsCreateOpen(false);
      fetchData();
    } catch {
      // Fallback
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingSuggestions = suggestions.filter((s) => !s.is_approved && !s.is_dismissed);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 font-sans select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-hairline">
        <div>
          <h1 className="font-serif text-title sm:text-display font-medium text-ink tracking-tight leading-tight">
            Tasks & Obligations
          </h1>
          <p className="text-caption text-ink-secondary mt-1">
            Contractual deadlines, deliverables, and detected commitments across documents.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Task</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border-hairline pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("actions")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-ui font-medium border-b-2 transition -mb-px cursor-pointer",
            activeTab === "actions"
              ? "border-gold text-ink font-semibold"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>Action Items ({actions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-ui font-medium border-b-2 transition -mb-px cursor-pointer",
            activeTab === "suggestions"
              ? "border-gold text-ink font-semibold"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          <span>Candidate Suggestions</span>
          {pendingSuggestions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-micro font-mono bg-gold/15 text-gold-fg border border-gold/30">
              {pendingSuggestions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reminders")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2 text-ui font-medium border-b-2 transition -mb-px cursor-pointer",
            activeTab === "reminders"
              ? "border-gold text-ink font-semibold"
              : "border-transparent text-ink-muted hover:text-ink"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Reminders ({reminders.length})</span>
        </button>
      </div>

      {/* Loading Skeleton matching layout */}
      {loading ? (
        <div className="bg-surface border border-border-hairline rounded-lg divide-y divide-border-hairline overflow-hidden">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="p-4 flex items-start gap-3.5 animate-pulse">
              <div className="h-4 w-4 rounded-sm bg-surface-subtle mt-0.5 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-surface-subtle rounded-sm w-56" />
                <div className="h-3 bg-surface-subtle rounded-sm w-80" />
                <div className="h-3 bg-surface-subtle rounded-sm w-36" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Tab 1: Action Items */}
      {!loading && activeTab === "actions" && (
        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border-hairline rounded-lg bg-surface space-y-3">
              <div className="h-10 w-10 rounded-md bg-surface-subtle flex items-center justify-center text-ink-muted mx-auto border border-border-hairline">
                <CheckSquare className="h-5 w-5" />
              </div>
              <h3 className="font-serif text-title font-medium text-ink">No action items yet</h3>
              <p className="text-caption text-ink-secondary max-w-sm mx-auto">
                Create tasks manually or approve AI-extracted obligations from your uploaded documents.
              </p>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="mt-2 gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Task</span>
              </Button>
            </div>
          ) : (
            <div className="bg-surface border border-border-hairline rounded-lg divide-y divide-border-hairline overflow-hidden">
              {actions.map((item) => {
                const isDone = item.status === "completed";
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-start justify-between gap-3 hover:bg-surface-subtle/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(item)}
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors cursor-pointer",
                          isDone
                            ? "bg-verdigris border-verdigris text-white"
                            : "border-border-hairline hover:border-gold bg-surface"
                        )}
                      >
                        {isDone && <Check className="h-3 w-3 stroke-[2.5]" />}
                      </button>

                      <div className="min-w-0 space-y-1">
                        <p
                          className={cn(
                            "text-ui font-medium text-ink",
                            isDone && "line-through text-ink-muted opacity-60"
                          )}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-caption text-ink-secondary leading-relaxed">{item.description}</p>
                        )}
                        {item.source_evidence_quote && (
                          <p className="text-caption text-ink-muted italic border-l border-gold pl-2 mt-1">
                            "{item.source_evidence_quote}" {item.page_number && `(p. ${item.page_number})`}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-caption text-ink-muted pt-1">
                          {item.due_date && (
                            <span className="flex items-center gap-1 font-mono text-micro">
                              <Calendar className="h-3 w-3 text-gold" />
                              {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span
                            className={cn(
                              "font-mono capitalize px-2 py-0.5 rounded-sm text-micro",
                              item.priority === "critical" && "bg-destructive/10 text-destructive border border-destructive/20",
                              item.priority === "high" && "bg-gold/10 text-gold-fg border border-gold/25",
                              item.priority === "medium" && "bg-surface-subtle text-ink-secondary border border-border-hairline",
                              item.priority === "low" && "bg-surface-subtle text-ink-muted"
                            )}
                          >
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAction(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-surface-subtle text-ink-muted hover:text-destructive transition-all cursor-pointer"
                      title="Delete action item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Candidate Suggestions */}
      {!loading && activeTab === "suggestions" && (
        <div className="space-y-4">
          <div className="p-4 bg-surface border border-border-hairline rounded-lg flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-gold shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-ui font-medium text-ink">Extracted Obligations</span>
              <p className="text-caption text-ink-secondary leading-relaxed">
                Docora detects commitments, covenants, and deadlines in uploaded documents. Review candidates and approve them into actionable items.
              </p>
            </div>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border-hairline rounded-lg bg-surface space-y-2">
              <CheckCircle2 className="h-6 w-6 text-verdigris mx-auto" />
              <p className="font-serif text-title font-medium text-ink">No pending suggestions</p>
              <p className="text-caption text-ink-secondary">All discovered obligations have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSuggestions.map((sug) => (
                <div key={sug.id} className="p-4 bg-surface border border-border-hairline rounded-lg space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-ui font-medium text-ink">{sug.title}</h3>
                      {sug.description && (
                        <p className="text-caption text-ink-secondary mt-0.5">{sug.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-sm text-micro font-mono bg-surface-subtle text-ink-secondary border border-border-hairline capitalize shrink-0">
                      {sug.category.replace("_", " ")}
                    </span>
                  </div>

                  <div className="p-3 bg-surface-subtle rounded-md border border-border-hairline text-caption space-y-1">
                    <span className="text-ink-muted font-mono text-micro uppercase tracking-wider">
                      Source Evidence (Page {sug.page_number}):
                    </span>
                    <p className="text-ink italic">"{sug.evidence_text}"</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-ink-secondary text-caption">
                      {sug.proposed_due_date && (
                        <span className="flex items-center gap-1 font-mono text-micro text-ink">
                          <Calendar className="h-3 w-3 text-gold" />
                          Target: {new Date(sug.proposed_due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className="font-mono text-micro text-ink-muted">Confidence: {Math.round(sug.confidence_score * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismissSuggestion(sug.id)}
                      >
                        Dismiss
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleApproveSuggestion(sug.id)}
                      >
                        Approve Item
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Reminders */}
      {!loading && activeTab === "reminders" && (
        <div className="space-y-3">
          {reminders.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-border-hairline rounded-lg bg-surface space-y-2">
              <Clock className="h-6 w-6 text-ink-muted mx-auto" />
              <p className="font-serif text-title font-medium text-ink">No active reminders</p>
              <p className="text-caption text-ink-secondary">Reminders notify you when tracked document deadlines approach.</p>
            </div>
          ) : (
            <div className="bg-surface border border-border-hairline rounded-lg divide-y divide-border-hairline overflow-hidden">
              {reminders.map((rem) => (
                <div key={rem.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-ui font-medium text-ink">{rem.title}</p>
                    <div className="flex items-center gap-3 text-caption text-ink-muted">
                      <span className="flex items-center gap-1 font-mono text-micro">
                        <Calendar className="h-3 w-3 text-gold" />
                        {new Date(rem.due_date).toLocaleString()}
                      </span>
                      <span className="capitalize font-mono text-micro text-verdigris">{rem.status}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-sm text-micro font-mono bg-surface-subtle text-verdigris border border-border-hairline">
                    Scheduled
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-surface border border-border-hairline rounded-lg shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-hairline pb-3">
              <h2 className="font-serif text-title font-medium text-ink">Create New Task</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-ink-muted hover:text-ink p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAction} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-caption font-medium text-ink-secondary">Title</label>
                <Input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Verify indemnification clause in Q3 contract"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-caption font-medium text-ink-secondary">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border-hairline bg-surface text-ink text-[16px] sm:text-ui focus:outline-hidden focus:border-gold transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-caption font-medium text-ink-secondary">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-md border border-border-hairline bg-surface text-ink text-ui focus:outline-hidden focus:border-gold capitalize transition-colors"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-hairline">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  className="gap-1.5"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Task</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
