"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { UploadQueueWidget } from "@/components/upload/UploadQueueWidget";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isNotebookWorkspace = Boolean(
    pathname?.startsWith("/notebooks/") && pathname !== "/notebooks"
  );
  const isAuthPage = Boolean(
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password"
  );

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthPage) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/notebooks")}`);
    }
  }, [isLoading, isAuthenticated, isAuthPage, pathname, router]);

  if (isAuthPage) {
    return (
      <div className="min-h-screen w-full bg-[#F8F9FA] text-neutral-900 flex flex-col">
        {children}
      </div>
    );
  }

  if (isNotebookWorkspace) {
    return (
      <div className="h-screen w-screen overflow-hidden bg-[#F4F5F7] text-neutral-900 flex flex-col">
        {children}
        <UploadQueueWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-neutral-900 font-sans antialiased flex w-full relative">
      {/* 5-Item Navigation Sidebar (Responsive Desktop & Mobile Drawer) */}
      <Sidebar
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Background Upload Indicator */}
      <UploadQueueWidget />
    </div>
  );
}
