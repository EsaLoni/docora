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
  ChevronRight,
  Filter,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [activeTab, setActiveTab] = useState<"actions" | "reminders" | "suggestions">("actions");
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [suggestions, setSuggestions] = useState<ActionSuggestion[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New item modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">("medium");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [actRes, sugRes, remRes] = await Promise.all([
        apiClient.listActions().catch(() => ({ items: [] })),
        apiClient.listActionSuggestions().catch(() => ({ items: [] })),
        apiClient.listReminders().catch(() => ({ items: [] })),
      ]);

      setActions((actRes.items as any) || []);
      setSuggestions(sugRes.items || []);
      setReminders(remRes.items || []);
    } catch (e) {
      console.warn("Failed to fetch tasks data", e);
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissSuggestion = async (sugId: string) => {
    try {
      await apiClient.dismissActionSuggestion(sugId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

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
    } catch (err) {
      console.error(err);
    }
  };

  const pendingSuggestions = suggestions.filter((s) => !s.is_approved && !s.is_dismissed);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-black/[0.08]">
        <div>
          <h1 className="text-[28px] font-bold text-neutral-900 tracking-tight leading-tight">
            Tasks & Obligations
          </h1>
          <p className="text-[13px] text-neutral-500 mt-1">
            Track extracted deliverables, contractual deadlines, and AI-discovered commitments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-semibold hover:bg-[#D97706] transition shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-black/[0.08] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("actions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg cursor-pointer",
            activeTab === "actions"
              ? "border-[#E5A93B] text-neutral-900 font-semibold bg-neutral-100/70"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>Action Items ({actions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg cursor-pointer",
            activeTab === "suggestions"
              ? "border-[#E5A93B] text-neutral-900 font-semibold bg-neutral-100/70"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
          )}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-600" />
          <span>Candidate Suggestions</span>
          {pendingSuggestions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 border border-amber-500/30">
              {pendingSuggestions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reminders")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg cursor-pointer",
            activeTab === "reminders"
              ? "border-[#E5A93B] text-neutral-900 font-semibold bg-neutral-100/70"
              : "border-transparent text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Reminders ({reminders.length})</span>
        </button>
      </div>

      {/* Tab 1: Action Items */}
      {activeTab === "actions" && (
        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-black/[0.12] rounded-2xl bg-white space-y-3 shadow-xs">
              <CheckSquare className="h-8 w-8 text-neutral-400 mx-auto" />
              <p className="text-[16px] font-semibold text-neutral-900">No action items yet</p>
              <p className="text-[13px] text-neutral-500 max-w-sm mx-auto">
                Create tasks manually or approve AI-extracted obligations from your uploaded documents.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-black/[0.08] rounded-2xl divide-y divide-black/[0.06] overflow-hidden shadow-xs">
              {actions.map((item) => {
                const isDone = item.status === "completed";
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-start justify-between gap-3 hover:bg-neutral-50/80 transition group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(item)}
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer",
                          isDone
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-neutral-300 hover:border-amber-600 bg-white"
                        )}
                      >
                        {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 space-y-1">
                        <p
                          className={cn(
                            "text-[15px] font-semibold text-neutral-900",
                            isDone && "line-through text-neutral-400 opacity-60"
                          )}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-[13px] text-neutral-600 leading-relaxed">{item.description}</p>
                        )}
                        {item.source_evidence_quote && (
                          <p className="text-[12px] text-neutral-600 italic border-l-2 border-amber-500/70 pl-2 mt-1">
                            "{item.source_evidence_quote}" {item.page_number && `(p. ${item.page_number})`}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[12px] text-neutral-500 pt-1">
                          {item.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-amber-600" />
                              {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span
                            className={cn(
                              "font-medium capitalize px-2 py-0.5 rounded-md text-[11px]",
                              item.priority === "critical" && "bg-rose-50 text-rose-700 border border-rose-200",
                              item.priority === "high" && "bg-amber-50 text-amber-800 border border-amber-200",
                              item.priority === "medium" && "bg-neutral-100 text-neutral-700 border border-black/[0.08]",
                              item.priority === "low" && "bg-neutral-50 text-neutral-600"
                            )}
                          >
                            {item.priority} priority
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAction(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 text-neutral-400 hover:text-rose-600 transition"
                      title="Delete action item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Candidate Suggestions */}
      {activeTab === "suggestions" && (
        <div className="space-y-4">
          <div className="p-4 bg-white border border-black/[0.08] rounded-2xl flex items-start gap-3 shadow-xs">
            <Sparkles className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[14px] font-semibold text-neutral-900">Human-in-the-Loop Extraction</span>
              <p className="text-[12px] text-neutral-600 leading-relaxed">
                Docora scans contracts, invoices, and reports to detect commitments and renewal deadlines. Review candidate suggestions below and approve them into actionable items.
              </p>
            </div>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-black/[0.12] rounded-2xl bg-white space-y-2 shadow-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="text-[16px] font-semibold text-neutral-900">No pending suggestions</p>
              <p className="text-[13px] text-neutral-500">All discovered obligations have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSuggestions.map((sug) => (
                <div key={sug.id} className="p-5 bg-white border border-black/[0.08] rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-neutral-900">{sug.title}</h3>
                      {sug.description && (
                        <p className="text-[13px] text-neutral-600 mt-0.5">{sug.description}</p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-800 border border-amber-500/25 capitalize shrink-0">
                      {sug.category.replace("_", " ")}
                    </span>
                  </div>

                  <div className="p-3 bg-neutral-50 rounded-xl border border-black/[0.06] text-[12px] space-y-1">
                    <span className="text-neutral-500 font-medium text-[11px] uppercase tracking-wider">
                      Source Evidence (Page {sug.page_number}):
                    </span>
                    <p className="text-neutral-800 italic">"{sug.evidence_text}"</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-neutral-500 text-[12px]">
                      {sug.proposed_due_date && (
                        <span className="flex items-center gap-1 font-medium text-neutral-800">
                          <Calendar className="h-3.5 w-3.5 text-amber-600" />
                          Target: {new Date(sug.proposed_due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span>Confidence: {Math.round(sug.confidence_score * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(sug.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveSuggestion(sug.id)}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#E5A93B] text-neutral-950 hover:bg-[#D97706] transition shadow-xs cursor-pointer"
                      >
                        Approve Item
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Reminders */}
      {activeTab === "reminders" && (
        <div className="space-y-3">
          {reminders.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-black/[0.12] rounded-2xl bg-white space-y-2 shadow-xs">
              <Clock className="h-8 w-8 text-neutral-400 mx-auto" />
              <p className="text-[16px] font-semibold text-neutral-900">No active reminders</p>
              <p className="text-[13px] text-neutral-500">Reminders dispatch notifications on scheduled deadline dates.</p>
            </div>
          ) : (
            <div className="bg-white border border-black/[0.08] rounded-2xl divide-y divide-black/[0.06] overflow-hidden shadow-xs">
              {reminders.map((rem) => (
                <div key={rem.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-neutral-900">{rem.title}</p>
                    <div className="flex items-center gap-3 text-neutral-500 text-[12px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-amber-600" />
                        {new Date(rem.due_date).toLocaleString()}
                      </span>
                      <span className="capitalize font-medium text-emerald-700">{rem.status}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-black/[0.08] rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-neutral-900">Create New Task</h2>
            <form onSubmit={handleCreateAction} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-700">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Follow up on Q4 renewal clause"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-neutral-50 text-neutral-900 text-xs focus:border-amber-500/70 focus:bg-white outline-hidden transition shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-neutral-50 text-neutral-900 text-xs focus:border-amber-500/70 focus:bg-white outline-hidden transition shadow-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-700">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] bg-neutral-50 text-neutral-900 text-xs focus:border-amber-500/70 focus:bg-white outline-hidden capitalize transition shadow-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-black/[0.08] text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#E5A93B] text-neutral-950 text-xs font-semibold hover:bg-[#D97706] shadow-xs transition cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
