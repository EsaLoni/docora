"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Mail, ArrowRight, Loader2, Sparkles, CheckCircle2, KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ message: string; reset_token?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    if (!email.trim()) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.forgotPassword(email);
      setSuccessInfo({ message: res.message, reset_token: res.reset_token });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to dispatch password reset request.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#0B0B0B] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8AB4F8]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#1F1F1F] border border-[#303030] shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#282828] border border-[#3A3A3A] mb-4 text-[#8AB4F8] shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F3F4]">
            Reset Password
          </h1>
          <p className="text-sm text-[#B8BDC7] mt-1.5">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
            <span className="text-red-400 font-bold">•</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-emerald-300">Instructions Dispatched</p>
                <p className="text-xs text-emerald-400/80 mt-1">{successInfo.message}</p>
              </div>
            </div>

            {successInfo.reset_token && (
              <div className="p-4 rounded-2xl bg-[#141414] border border-[#303030]">
                <p className="text-xs font-semibold text-[#8AB4F8] mb-1.5">Dev/Test Recovery Token:</p>
                <p className="text-xs font-mono break-all text-[#B8BDC7] bg-[#0B0B0B] p-2.5 rounded-lg select-all">
                  {successInfo.reset_token}
                </p>
                <div className="mt-3">
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(successInfo.reset_token)}`}
                    className="inline-flex items-center gap-1.5 text-xs text-[#8AB4F8] font-medium hover:underline"
                  >
                    Proceed directly to Reset Password screen →
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="text-xs text-[#8AB4F8] hover:underline"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium uppercase tracking-wider text-[#9299A4] mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#9299A4]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141414] border border-[#303030] text-[#F1F3F4] placeholder-[#666] text-sm focus:outline-none focus:border-[#8AB4F8] focus:ring-1 focus:ring-[#8AB4F8] transition-colors"
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
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="mt-6 pt-5 border-t border-[#2A2A2A] text-center text-xs text-[#B8BDC7]">
              Remembered your password?{" "}
              <Link
                href="/login"
                className="text-[#8AB4F8] font-medium hover:underline ml-1"
              >
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
