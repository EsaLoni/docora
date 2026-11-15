"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Lock, Eye, EyeOff, KeyRound, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

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
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1F1F1F] border border-[#303030] shadow-2xl relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4 text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-[#F1F3F4]">Password Reset Complete</h2>
        <p className="text-sm text-[#B8BDC7] mt-2 mb-6">
          Your password has been successfully updated. You may now log in with your new credentials.
        </p>
        <Link
          href="/login"
          className="w-full py-3 px-4 rounded-xl bg-[#3156D8] hover:bg-[#2546C4] text-white font-medium text-sm inline-flex items-center justify-center gap-2"
        >
          <span>Continue to Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1F1F1F] border border-[#303030] shadow-2xl relative z-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#282828] border border-[#3A3A3A] mb-4 text-[#8AB4F8] shadow-inner">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F3F4]">
          Set New Password
        </h1>
        <p className="text-sm text-[#B8BDC7] mt-1.5">
          Enter your recovery token and choose a secure password
        </p>
      </div>

      {errorMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
          <span className="text-red-400 font-bold">•</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="token"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
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
            className="w-full px-4 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-xs font-mono focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
          />
        </div>

        <div>
          <label
            htmlFor="new_password"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            New Password (min 8 characters)
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="new_password"
              type={showPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#9299A4] hover:text-[#F1F3F4] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirm_new_password"
            className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
          >
            Confirm New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="confirm_new_password"
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-[#3156D8] hover:bg-[#2546C4] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Updating password...</span>
            </>
          ) : (
            <>
              <span>Update Password</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#2A2A2A] text-center text-xs text-[#B8BDC7]">
        Remember your credentials?{" "}
        <Link
          href="/login"
          className="text-[#8AB4F8] font-medium hover:underline ml-1"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-[#0B0B0B] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8AB4F8]/5 rounded-full blur-3xl pointer-events-none" />
      <Suspense
        fallback={
          <div className="text-sm text-[#9299A4] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#8AB4F8]" />
            Loading reset form...
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
