"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowUpDown,
  Search,
  RefreshCw,
  LogIn,
  Calendar,
  Lock,
  BookOpen,
  FileText,
  Layers,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { apiClient, AdminUserItem, AdminStatsResponse } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

const AUTHORIZED_OWNER_EMAIL = "esaloni313@gmail.com";

export default function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [usersList, setUsersList] = useState<AdminUserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"last_login" | "registered" | "login_count" | "email">("last_login");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Strict owner validation
  const isOwner = useMemo(() => {
    if (!user?.email) return false;
    const email = user.email.toLowerCase();
    return (
      email === AUTHORIZED_OWNER_EMAIL ||
      (process.env.NODE_ENV !== "production" && email === "dev@udip.local")
    );
  }, [user]);

  const loadAdminTelemetry = async () => {
    if (!isOwner) return;
    setIsLoadingData(true);
    setErrorMsg(null);
    try {
      const [statsData, usersData] = await Promise.all([
        apiClient.getAdminStats(),
        apiClient.getAdminUsers(sortBy, 100, 0),
      ]);
      setStats(statsData);
      setUsersList(usersData.users);
      setTotalUsers(usersData.total_users);
    } catch (err: any) {
      console.error("Failed to load admin telemetry:", err);
      setErrorMsg(err.message || "Unable to fetch telemetry data from backend.");
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthLoading && isOwner) {
      loadAdminTelemetry();
    }
  }, [isAuthLoading, isOwner, sortBy]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAdminTelemetry();
  };

  // Filtered users by query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersList;
    const q = searchQuery.toLowerCase().trim();
    return usersList.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name && u.full_name.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
    );
  }, [usersList, searchQuery]);

  // Helper date formatter
  const formatTimestamp = (isoStr?: string | null) => {
    if (!isoStr) return "Never logged in";
    try {
      const date = new Date(isoStr);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(date);
    } catch {
      return isoStr;
    }
  };

  const formatRelativeTime = (isoStr?: string | null) => {
    if (!isoStr) return "Never";
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 30) return `${diffDays}d ago`;
      return formatTimestamp(isoStr);
    } catch {
      return "Recently";
    }
  };

  // 1. Loading State while checking authentication
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-caption font-mono text-ink-muted">Verifying platform credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Strict Unauthorized Screen (Access Denied for non-owners)
  if (!isOwner) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-hairline bg-surface p-8 text-center space-y-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-title font-semibold text-ink">Access Restricted</h1>
          <p className="text-ui text-ink-secondary leading-relaxed">
            This administration console is strictly restricted to the Docora platform owner (
            <strong className="text-ink font-mono">{AUTHORIZED_OWNER_EMAIL}</strong>).
          </p>
          <p className="text-caption text-ink-muted">
            Your current authenticated account ({user?.email || "anonymous"}) does not possess telemetry
            clearance.
          </p>
          <div className="pt-3">
            <Link href="/notebooks" prefetch={false}>
              <Button variant="primary">Return to Notebooks</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Platform Owner View
  return (
    <div className="min-h-screen bg-canvas text-ink font-sans select-none pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-hairline pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/notebooks"
                className="text-caption text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Notebooks</span>
              </Link>
              <span className="text-ink-muted">/</span>
              <span className="text-caption font-mono text-verdigris flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Owner Console
              </span>
            </div>
            <h1 className="font-serif text-title font-semibold text-ink tracking-tight flex items-center gap-3">
              User Logins & Telemetry
            </h1>
            <p className="text-ui text-ink-secondary">
              Real-time platform access telemetry, registered user sessions, and login timestamps.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-md bg-surface border border-border-hairline flex items-center gap-1.5 text-caption font-mono text-ink-secondary">
              <span className="h-2 w-2 rounded-full bg-verdigris animate-pulse" />
              <span>Owner: {AUTHORIZED_OWNER_EMAIL}</span>
            </div>
            <Button
              variant="secondary"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoadingData}
              className="gap-2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Error Banner if any */}
        {errorMsg && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-ui flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <strong>Telemetry Error:</strong> {errorMsg}
            </div>
          </div>
        )}

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-ink-muted text-caption">
              <span>Total Registered</span>
              <Users className="h-4 w-4 text-ink-muted" />
            </div>
            <div className="font-mono text-2xl font-bold text-ink">
              {isLoadingData ? "..." : stats?.total_users ?? totalUsers}
            </div>
            <div className="text-micro text-ink-secondary">Registered accounts in database</div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-ink-muted text-caption">
              <span>Total Logins</span>
              <LogIn className="h-4 w-4 text-gold" />
            </div>
            <div className="font-mono text-2xl font-bold text-gold">
              {isLoadingData ? "..." : stats?.total_logins ?? 0}
            </div>
            <div className="text-micro text-ink-secondary">Cumulative authentication events</div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-ink-muted text-caption">
              <span>Active Accounts</span>
              <CheckCircle2 className="h-4 w-4 text-verdigris" />
            </div>
            <div className="font-mono text-2xl font-bold text-verdigris">
              {isLoadingData ? "..." : stats?.active_users ?? 0}
            </div>
            <div className="text-micro text-ink-secondary">Accounts in good standing</div>
          </div>

          <div className="rounded-xl border border-hairline bg-surface p-4 sm:p-5 space-y-1 shadow-xs">
            <div className="flex items-center justify-between text-ink-muted text-caption">
              <span>Artifacts / Sources</span>
              <Layers className="h-4 w-4 text-ink-muted" />
            </div>
            <div className="font-mono text-2xl font-bold text-ink">
              {isLoadingData
                ? "..."
                : `${stats?.total_notebooks ?? 0} / ${stats?.total_documents ?? 0}`}
            </div>
            <div className="text-micro text-ink-secondary">Notebooks & active documents</div>
          </div>
        </div>

        {/* Live Recent Logins Strip */}
        {stats?.recent_logins && stats.recent_logins.length > 0 && (
          <section className="rounded-xl border border-hairline bg-surface p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-verdigris" />
                <h2 className="text-section font-semibold text-ink">Latest User Sign-Ins</h2>
              </div>
              <span className="text-micro font-mono text-ink-muted uppercase">Live Feed</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
              {stats.recent_logins.map((rec) => (
                <div
                  key={`rec-${rec.id}`}
                  className="p-3 rounded-lg bg-surface-subtle border border-border-hairline space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-mono font-medium text-verdigris">
                      {formatRelativeTime(rec.last_login_at)}
                    </span>
                    <span className="text-micro font-mono text-ink-muted bg-surface px-1.5 py-0.5 rounded border border-border-hairline">
                      {rec.login_count}x
                    </span>
                  </div>
                  <div className="text-caption font-medium text-ink truncate" title={rec.email}>
                    {rec.email}
                  </div>
                  <div className="text-micro text-ink-muted truncate">
                    {rec.full_name || "Unnamed Researcher"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Full Users Directory & Session Log */}
        <section className="rounded-xl border border-hairline bg-surface space-y-4 shadow-xs overflow-hidden">
          {/* Table Header Controls */}
          <div className="p-5 border-b border-border-hairline flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-section font-semibold text-ink">Registered Users Directory</h2>
              <p className="text-caption text-ink-secondary mt-0.5">
                Inspect every account, login frequency, and last authenticated timestamp.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  placeholder="Filter email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-md border border-border-hairline bg-surface-subtle text-caption text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-gold"
                />
              </div>

              {/* Sort Order Selector */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <ArrowUpDown className="h-4 w-4 text-ink-muted shrink-0" />
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="w-full sm:w-auto py-1.5 px-3 rounded-md border border-border-hairline bg-surface-subtle text-caption text-ink focus:outline-none focus:ring-1 focus:ring-gold font-mono"
                >
                  <option value="last_login">Sort: Recent Login</option>
                  <option value="login_count">Sort: Most Logins</option>
                  <option value="registered">Sort: Newest First</option>
                  <option value="email">Sort: Email (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-caption border-collapse">
              <thead>
                <tr className="bg-surface-subtle border-b border-border-hairline text-ink-muted font-mono text-micro uppercase">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role / Status</th>
                  <th className="py-3 px-4">Total Logins</th>
                  <th className="py-3 px-4">Last Login Time</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4 text-right">Workspaces</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-hairline font-sans">
                {isLoadingData ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-muted font-mono">
                      Loading user records from database...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-muted">
                      {searchQuery ? "No users match your search query." : "No registered users found."}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = u.email.toLowerCase() === AUTHORIZED_OWNER_EMAIL;
                    return (
                      <tr key={u.id} className="hover:bg-surface-subtle/60 transition-colors">
                        {/* User Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-surface-subtle border border-border-hairline text-ink flex items-center justify-center font-mono font-bold text-caption shrink-0">
                              {u.email.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-ink truncate">
                                  {u.full_name || "Unnamed"}
                                </span>
                                {isSelf && (
                                  <span className="px-1.5 py-0.2 rounded text-micro font-mono bg-gold/15 text-gold border border-gold/30">
                                    Owner
                                  </span>
                                )}
                              </div>
                              <span className="text-micro font-mono text-ink-secondary truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Status */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-micro uppercase font-mono px-2 py-0.5 rounded bg-surface-subtle border border-border-hairline text-ink-secondary">
                              {u.role}
                            </span>
                            <span
                              className={`h-2 w-2 rounded-full ${
                                u.is_active ? "bg-verdigris" : "bg-destructive"
                              }`}
                              title={u.is_active ? "Active Account" : "Deactivated"}
                            />
                          </div>
                        </td>

                        {/* Login Count */}
                        <td className="py-3.5 px-4 font-mono font-medium text-ink">
                          <span className="px-2 py-0.5 rounded bg-surface-subtle border border-border-hairline">
                            {u.login_count || 0} logins
                          </span>
                        </td>

                        {/* Last Login Time */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col font-mono text-micro">
                            <span className="text-ink font-medium">
                              {formatRelativeTime(u.last_login_at)}
                            </span>
                            <span className="text-ink-muted">
                              {formatTimestamp(u.last_login_at)}
                            </span>
                          </div>
                        </td>

                        {/* Joined Date */}
                        <td className="py-3.5 px-4 font-mono text-micro text-ink-secondary">
                          {formatTimestamp(u.registered_at)}
                        </td>

                        {/* Workspaces Count */}
                        <td className="py-3.5 px-4 text-right font-mono text-ink-secondary">
                          {u.workspace_count}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
