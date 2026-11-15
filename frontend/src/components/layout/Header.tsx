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
      setNotifications(data.items as any || []);
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
      <header className="h-16 border-b border-[#273247] bg-[#0B0D12]/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 gap-3">
        {/* Left Side: Mobile Hamburger & Search Bar */}
        <div className="flex items-center gap-2.5">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-2 rounded-xl text-[#A0AEC0] hover:text-[#F1F5FC] hover:bg-[#151B27] md:hidden shrink-0 border border-[#273247]"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Global Search Interactive Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between w-48 sm:w-72 md:w-96 bg-[#151B27] border border-[#273247] rounded-xl px-3 sm:px-3.5 py-2 text-xs text-[#A0AEC0] hover:border-[#6D8FFF]/60 hover:bg-[#1B2332] transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#A0AEC0] group-hover:text-[#6D8FFF] transition-colors" />
              <span className="truncate">Search documents, chunks...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-[#1B2332] border border-[#273247] rounded-md text-[#A0AEC0]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          {/* Backend Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-[#273247] bg-[#151B27]">
            <Activity
              className={`h-3 w-3 ${
                backendStatus === "online"
                  ? "text-[#34D399] animate-pulse"
                  : backendStatus === "checking"
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            />
            <span className="text-[#A0AEC0]">API:</span>
            <span
              className={
                backendStatus === "online"
                  ? "text-[#34D399] font-medium"
                  : backendStatus === "checking"
                  ? "text-amber-400"
                  : "text-rose-400"
              }
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
              className="relative h-9 w-9 rounded-xl border border-[#273247] bg-[#151B27] hover:bg-[#1B2332] flex items-center justify-center text-[#A0AEC0] hover:text-[#F1F5FC] transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-[#0B0D12]" />
              )}
            </button>

            {/* Dropdown Notification Tray */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#151B27] border border-[#273247] rounded-2xl shadow-2xl z-50 overflow-hidden text-left">
                <div className="p-3.5 border-b border-[#273247] flex items-center justify-between bg-[#10141D]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#F1F5FC]">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-300 border border-rose-800/50">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-medium text-[#6D8FFF] hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#273247]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#A0AEC0]">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs transition flex items-start justify-between gap-3 ${
                          n.is_read ? "opacity-60 bg-[#151B27]" : "bg-[#1B2332]"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-[#F1F5FC]">{n.title}</p>
                          <p className="text-[11px] text-[#A0AEC0] line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-[#A0AEC0]/70 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {!n.is_read && (
                          <button
                            onClick={(e) => markAsRead(n.id, e)}
                            className="p-1 rounded hover:bg-[#273247] text-[#A0AEC0] hover:text-[#F1F5FC] shrink-0"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-[#273247] bg-[#10141D] text-center">
                  <Link
                    href="/tasks"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-[11px] font-semibold text-[#6D8FFF] hover:underline"
                  >
                    View All Tasks & Deadlines →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Pill */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[#273247]">
            <div className="h-8 w-8 rounded-xl bg-[#1B2332] text-[#6D8FFF] border border-[#273247] flex items-center justify-center font-bold text-xs shrink-0">
              {getInitials(user?.full_name, user?.email)}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#F1F5FC] leading-tight">
                {user?.full_name || "Research Scientist"}
              </span>
              <span className="text-[11px] text-[#A0AEC0] leading-tight">
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
