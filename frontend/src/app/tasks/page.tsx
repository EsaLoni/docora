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
      const headers = {
        "x-dev-user-email": user?.email || "dev@udip.local",
        ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
      };
      const [actRes, sugRes, remRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/actions", { headers }),
        fetch("http://localhost:8000/api/v1/actions/suggestions", { headers }),
        fetch("http://localhost:8000/api/v1/reminders", { headers }),
      ]);

      if (actRes.ok) {
        const d = await actRes.json();
        setActions(d.items || []);
      }
      if (sugRes.ok) {
        const d = await sugRes.json();
        setSuggestions(d.items || []);
      }
      if (remRes.ok) {
        const d = await remRes.json();
        setReminders(d.items || []);
      }
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
    const endpoint = isCompleted ? "reopen" : "complete";
    try {
      await fetch(`http://localhost:8000/api/v1/actions/${action.id}/${endpoint}`, {
        method: "POST",
        headers: {
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
      });
      fetchData();
    } catch {
      setActions((prev) =>
        prev.map((a) => (a.id === action.id ? { ...a, status: isCompleted ? "pending" : "completed" } : a))
      );
    }
  };

  const handleDeleteAction = async (id: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/actions/${id}`, {
        method: "DELETE",
        headers: {
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
      });
      fetchData();
    } catch {
      setActions((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleApproveSuggestion = async (sugId: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/actions/suggestions/${sugId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
        body: JSON.stringify({ priority: "high" }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDismissSuggestion = async (sugId: string) => {
    try {
      await fetch(`http://localhost:8000/api/v1/actions/suggestions/${sugId}/dismiss`, {
        method: "POST",
        headers: {
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await fetch("http://localhost:8000/api/v1/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-dev-user-email": user?.email || "dev@udip.local",
          ...(apiClient.getAuthToken() ? { Authorization: `Bearer ${apiClient.getAuthToken()}` } : {}),
        },
        body: JSON.stringify({
          title: newTitle.trim(),
          priority: newPriority,
          due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        }),
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#273247]">
        <div>
          <h1 className="text-[30px] font-semibold text-[#F1F5FC] tracking-tight leading-tight">
            Tasks & Obligations
          </h1>
          <p className="text-[13px] text-[#A0AEC0] mt-1">
            Track extracted deliverables, contractual deadlines, and AI-discovered commitments.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Task</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-[#273247] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab("actions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg",
            activeTab === "actions"
              ? "border-[#6D8FFF] text-[#6D8FFF] font-semibold bg-[#151B27]"
              : "border-transparent text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#151B27]/50"
          )}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span>Action Items ({actions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suggestions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg",
            activeTab === "suggestions"
              ? "border-[#6D8FFF] text-[#6D8FFF] font-semibold bg-[#151B27]"
              : "border-transparent text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#151B27]/50"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Candidate Suggestions</span>
          {pendingSuggestions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#6D8FFF]/15 text-[#6D8FFF] border border-[#6D8FFF]/30">
              {pendingSuggestions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reminders")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition -mb-px rounded-t-lg",
            activeTab === "reminders"
              ? "border-[#6D8FFF] text-[#6D8FFF] font-semibold bg-[#151B27]"
              : "border-transparent text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#151B27]/50"
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
            <div className="p-12 text-center border border-dashed border-[#273247] rounded-2xl bg-[#151B27] space-y-3">
              <CheckSquare className="h-8 w-8 text-[#A0AEC0]/60 mx-auto" />
              <p className="text-[16px] font-semibold text-[#F1F5FC]">No action items yet</p>
              <p className="text-[13px] text-[#A0AEC0] max-w-sm mx-auto">
                Create tasks manually or approve AI-extracted obligations from your uploaded documents.
              </p>
            </div>
          ) : (
            <div className="bg-[#151B27] border border-[#273247] rounded-2xl divide-y divide-[#273247] overflow-hidden shadow-sm">
              {actions.map((item) => {
                const isDone = item.status === "completed";
                return (
                  <div
                    key={item.id}
                    className="p-4 flex items-start justify-between gap-3 hover:bg-[#1B2332]/50 transition group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(item)}
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center shrink-0 transition cursor-pointer",
                          isDone
                            ? "bg-[#34D399] border-[#34D399] text-[#0B0D12]"
                            : "border-[#273247] hover:border-[#6D8FFF] bg-[#10141D]"
                        )}
                      >
                        {isDone && <Check className="h-3 w-3 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 space-y-1">
                        <p
                          className={cn(
                            "text-[15px] font-semibold text-[#F1F5FC]",
                            isDone && "line-through text-[#A0AEC0] opacity-60"
                          )}
                        >
                          {item.title}
                        </p>
                        {item.description && (
                          <p className="text-[13px] text-[#A0AEC0] leading-relaxed">{item.description}</p>
                        )}
                        {item.source_evidence_quote && (
                          <p className="text-[12px] text-[#A0AEC0] italic border-l-2 border-[#6D8FFF]/60 pl-2 mt-1">
                            "{item.source_evidence_quote}" {item.page_number && `(p. ${item.page_number})`}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-[12px] text-[#A0AEC0] pt-1">
                          {item.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-[#6D8FFF]" />
                              {new Date(item.due_date).toLocaleDateString()}
                            </span>
                          )}
                          <span
                            className={cn(
                              "font-medium capitalize px-2 py-0.5 rounded-md text-[11px]",
                              item.priority === "critical" && "bg-rose-950/40 text-rose-300 border border-rose-800/40",
                              item.priority === "high" && "bg-amber-950/40 text-amber-300 border border-amber-800/40",
                              item.priority === "medium" && "bg-[#6D8FFF]/10 text-[#6D8FFF] border border-[#6D8FFF]/30",
                              item.priority === "low" && "bg-[#1B2332] text-[#A0AEC0]"
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
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#151B27] text-[#A0AEC0] hover:text-rose-400 transition"
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
          <div className="p-4 bg-[#151B27] border border-[#273247] rounded-2xl flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#6D8FFF] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[14px] font-semibold text-[#F1F5FC]">Human-in-the-Loop Extraction</span>
              <p className="text-[12px] text-[#A0AEC0] leading-relaxed">
                Docora scans contracts, invoices, and reports to detect commitments and renewal deadlines. Review candidate suggestions below and approve them into actionable items.
              </p>
            </div>
          </div>

          {pendingSuggestions.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-[#273247] rounded-2xl bg-[#151B27] space-y-2">
              <CheckCircle2 className="h-8 w-8 text-[#34D399] mx-auto" />
              <p className="text-[16px] font-semibold text-[#F1F5FC]">No pending suggestions</p>
              <p className="text-[13px] text-[#A0AEC0]">All discovered obligations have been reviewed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingSuggestions.map((sug) => (
                <div key={sug.id} className="p-5 bg-[#151B27] border border-[#273247] rounded-2xl space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[15px] font-semibold text-[#F1F5FC]">{sug.title}</h3>
                      {sug.description && (
                        <p className="text-[13px] text-[#A0AEC0] mt-0.5">{sug.description}</p>
                      )}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#6D8FFF]/10 text-[#6D8FFF] border border-[#6D8FFF]/30 capitalize shrink-0">
                      {sug.category.replace("_", " ")}
                    </span>
                  </div>

                  <div className="p-3 bg-[#10141D] rounded-xl border border-[#273247] text-[12px] space-y-1">
                    <span className="text-[#A0AEC0] font-medium text-[11px] uppercase tracking-wider">
                      Source Evidence (Page {sug.page_number}):
                    </span>
                    <p className="text-[#F1F5FC] italic">"{sug.evidence_text}"</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-[#A0AEC0] text-[12px]">
                      {sug.proposed_due_date && (
                        <span className="flex items-center gap-1 font-medium text-[#F1F5FC]">
                          <Calendar className="h-3.5 w-3.5 text-[#6D8FFF]" />
                          Target: {new Date(sug.proposed_due_date).toLocaleDateString()}
                        </span>
                      )}
                      <span>Confidence: {Math.round(sug.confidence_score * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleDismissSuggestion(sug.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332] transition"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveSuggestion(sug.id)}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#6D8FFF] text-[#0B0D12] hover:bg-[#84A2FF] transition shadow-xs"
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
            <div className="p-12 text-center border border-dashed border-[#273247] rounded-2xl bg-[#151B27] space-y-2">
              <Clock className="h-8 w-8 text-[#A0AEC0]/60 mx-auto" />
              <p className="text-[16px] font-semibold text-[#F1F5FC]">No active reminders</p>
              <p className="text-[13px] text-[#A0AEC0]">Reminders dispatch notifications on scheduled deadline dates.</p>
            </div>
          ) : (
            <div className="bg-[#151B27] border border-[#273247] rounded-2xl divide-y divide-[#273247] overflow-hidden">
              {reminders.map((rem) => (
                <div key={rem.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-[#F1F5FC]">{rem.title}</p>
                    <div className="flex items-center gap-3 text-[#A0AEC0] text-[12px]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[#6D8FFF]" />
                        {new Date(rem.due_date).toLocaleString()}
                      </span>
                      <span className="capitalize font-medium text-[#34D399]">{rem.status}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#34D399]/10 text-[#34D399] border border-[#34D399]/30">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#151B27] border border-[#273247] rounded-2xl shadow-2xl p-6 space-y-4">
            <h2 className="text-[18px] font-semibold text-[#F1F5FC]">Create New Task</h2>
            <form onSubmit={handleCreateAction} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#A0AEC0]">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Follow up on Q4 renewal clause"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs focus:border-[#6D8FFF] outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#A0AEC0]">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs focus:border-[#6D8FFF] outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#A0AEC0]">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#273247] bg-[#10141D] text-[#F1F5FC] text-xs focus:border-[#6D8FFF] outline-hidden capitalize"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#273247]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#273247] text-xs font-medium text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#1B2332]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#6D8FFF] text-[#0B0D12] text-xs font-semibold hover:bg-[#84A2FF] shadow-xs"
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
