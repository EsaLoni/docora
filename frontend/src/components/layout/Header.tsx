"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell, Activity, Command, Check, CheckCheck, Menu } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { GlobalSearchModal } from "@/components/search/GlobalSearchModal";
import { useAuth } from "@/context/AuthContext";

interface InAppNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export function Header({ onToggleMobileMenu }: HeaderProps) {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const fetchNotifications = async () => {
    try {
      const data = await apiClient.listNotifications(10);
      setNotifications((data.items as any) || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // Backend may be offline or initializing
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await apiClient.checkHealth();
        if (res && (res.status === "ok" || res.status === "healthy" || res.status)) {
          setBackendStatus("online");
          fetchNotifications();
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    };
    checkHealth();

    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const getInitials = (name?: string | null, email?: string) => {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return "DC";
  };

  return (
    <>
      <header className="h-14 border-b border-black/[0.08] bg-white/95 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 gap-3 select-none text-neutral-900 shadow-xs">
        {/* Left Side: Mobile Hamburger & Search Bar */}
        <div className="flex items-center gap-2.5">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 md:hidden shrink-0 border border-black/[0.08]"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Global Search Interactive Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between w-48 sm:w-64 md:w-80 bg-neutral-50 border border-black/[0.08] rounded-xl px-3 py-1.5 text-xs text-neutral-500 hover:border-black/[0.18] hover:bg-neutral-100 transition-all text-left group cursor-pointer shadow-xs"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400 group-hover:text-amber-700 transition-colors" />
              <span className="truncate">Search documents, citations...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white border border-black/[0.08] rounded-md text-neutral-500">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Backend Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-black/[0.08] bg-neutral-50">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                backendStatus === "online"
                  ? "bg-emerald-600"
                  : backendStatus === "checking"
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
            />
            <span className="text-neutral-500 text-[11px] font-mono">API:</span>
            <span
              className={`text-[11px] font-medium ${
                backendStatus === "online"
                  ? "text-emerald-400"
                  : backendStatus === "checking"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {backendStatus === "online" ? "Online" : backendStatus === "checking" ? "Checking..." : "Offline"}
            </span>
          </div>

          {/* Notifications Tray */}
          <div className="relative">
            <button
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                if (!isNotifOpen) fetchNotifications();
              }}
              className="relative h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
              title="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#08090D]" />
              )}
            </button>

            {/* Dropdown Notification Tray */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#12151F] border border-white/[0.08] rounded-2xl shadow-2xl z-50 overflow-hidden text-left animate-in fade-in duration-100">
                <div className="p-3 border-b border-white/[0.06] flex items-center justify-between bg-[#0E1118]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-medium text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-400">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs transition flex items-start justify-between gap-3 ${
                          n.is_read ? "opacity-60 bg-transparent" : "bg-white/[0.03]"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-white">{n.title}</p>
                          <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-neutral-500 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {!n.is_read && (
                          <button
                            onClick={(e) => markAsRead(n.id, e)}
                            className="p-1 rounded hover:bg-white/[0.08] text-neutral-400 hover:text-white shrink-0"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-white/[0.06] bg-[#0E1118] text-center">
                  <Link
                    href="/tasks"
                    prefetch={false}
                    onClick={() => setIsNotifOpen(false)}
                    className="text-[11px] font-medium text-indigo-400 hover:underline"
                  >
                    View All Tasks & Deadlines →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Pill */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-white/[0.08]">
            <div className="h-7 w-7 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
              {getInitials(user?.full_name, user?.email)}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-neutral-200 leading-tight">
                {user?.full_name || "Research Scientist"}
              </span>
              <span className="text-[10px] text-neutral-400 leading-tight">
                {user?.workspaces?.[0]?.name || "Personal Workspace"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Global Hybrid Retrieval Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
