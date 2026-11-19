"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Bell, Command, Check, CheckCheck, Menu } from "lucide-react";
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
      <header className="h-14 border-b border-border-hairline bg-surface/95 backdrop-blur-xs sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 gap-3 select-none text-ink font-sans">
        {/* Left Side: Mobile Hamburger & Search Bar */}
        <div className="flex items-center gap-2.5">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="p-1.5 rounded-md text-ink-secondary hover:text-ink hover:bg-surface-subtle md:hidden shrink-0 border border-border-hairline cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Global Search Interactive Trigger */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-between w-48 sm:w-64 md:w-80 bg-surface-subtle border border-border-hairline rounded-md px-3 py-1.5 text-caption text-ink-muted hover:border-gold hover:text-ink transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-muted group-hover:text-gold transition-colors" />
              <span className="truncate">Search documents, citations...</span>
            </div>
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-micro font-mono bg-surface border border-border-hairline rounded-sm text-ink-muted">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Backend Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-md text-caption border border-border-hairline bg-surface-subtle font-mono text-micro">
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                backendStatus === "online"
                  ? "bg-verdigris"
                  : backendStatus === "checking"
                  ? "bg-gold"
                  : "bg-destructive"
              }`}
            />
            <span className="text-ink-muted">API:</span>
            <span
              className={
                backendStatus === "online"
                  ? "text-verdigris"
                  : backendStatus === "checking"
                  ? "text-gold"
                  : "text-destructive"
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
              className="relative h-8 w-8 rounded-md border border-border-hairline bg-surface hover:bg-surface-subtle flex items-center justify-center text-ink-secondary hover:text-ink transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-gold ring-2 ring-surface" />
              )}
            </button>

            {/* Dropdown Notification Tray */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface border border-border-hairline rounded-lg shadow-xl z-50 overflow-hidden text-left animate-in fade-in duration-100">
                <div className="p-3 border-b border-border-hairline flex items-center justify-between bg-surface-subtle">
                  <div className="flex items-center gap-2">
                    <span className="font-serif text-title font-medium text-ink">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-sm text-micro font-mono bg-surface text-ink border border-border-hairline">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-caption text-gold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="h-3 w-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-border-hairline">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-caption text-ink-muted">
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-caption transition-colors flex items-start justify-between gap-3 ${
                          n.is_read ? "opacity-60 bg-transparent" : "bg-surface-subtle/50"
                        }`}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-ink">{n.title}</p>
                          <p className="text-micro text-ink-secondary line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <span className="text-micro font-mono text-ink-muted block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {!n.is_read && (
                          <button
                            onClick={(e) => markAsRead(n.id, e)}
                            className="p-1 rounded-sm hover:bg-surface-subtle text-ink-muted hover:text-ink shrink-0 cursor-pointer"
                            title="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2 border-t border-border-hairline bg-surface-subtle text-center">
                  <Link
                    href="/tasks"
                    prefetch={false}
                    onClick={() => setIsNotifOpen(false)}
                    className="text-caption text-gold hover:underline"
                  >
                    View All Tasks & Deadlines →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar Pill */}
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border-hairline">
            <div className="h-7 w-7 rounded-md bg-surface-subtle text-ink border border-border-hairline flex items-center justify-center font-mono font-semibold text-micro shrink-0">
              {getInitials(user?.full_name, user?.email)}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-caption font-medium text-ink leading-tight">
                {user?.full_name || "Researcher"}
              </span>
              <span className="text-micro font-mono text-ink-muted leading-tight">
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
