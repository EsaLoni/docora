"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") || "";

  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage("Reset token is required.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.resetPassword({ token: token.trim(), new_password: newPassword });
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err.message || err.detail || "Failed to reset password. The link or token may be expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-[#0F121A]/90 border border-white/[0.08] backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_0_rgba(255,255,255,0.06)] relative z-10 text-center select-none">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4 text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-neutral-900">Password Reset Complete</h2>
        <p className="text-xs text-neutral-500 mt-2 mb-6">
          Your password has been successfully updated. You may now log in with your new credentials.
        </p>
        <Link
          href="/login"
          prefetch={false}
          className="w-full py-2.5 px-4 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 font-bold text-xs inline-flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <span>Continue to Sign In</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] relative z-10 select-none">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-200">
          <DocoraSymbol size={48} />
        </div>
        <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-neutral-900">
          Set New Password
        </h1>
        <p className="text-xs text-neutral-500 mt-1.5 tracking-normal">
          Enter your recovery token and choose a secure password
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
          <span className="text-rose-500 font-bold shrink-0">•</span>
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="token"
            className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            Reset Token
          </label>
          <input
            id="token"
            type="text"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste recovery token..."
            className="w-full px-4 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs font-mono focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
          />
        </div>

        <div>
          <label
            htmlFor="new_password"
            className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            New Password (min 8 characters)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="new_password"
              type={showPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirm_new_password"
            className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirm_new_password"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-[#E5A93B] hover:bg-[#D97706] text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-neutral-950" />
              <span>Updating password...</span>
            </>
          ) : (
            <>
              <span>Update Password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-5 border-t border-black/[0.08] text-center text-xs text-neutral-600">
        <Link
          href="/login"
          prefetch={false}
          className="text-amber-700 font-semibold hover:underline"
        >
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <Suspense
        fallback={
          <div className="text-xs text-neutral-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            Loading reset form...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
