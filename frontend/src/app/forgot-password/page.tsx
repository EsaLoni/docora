"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Mail, ArrowRight, Loader2, CheckCircle2, KeyRound } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";

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
    <div className="min-h-screen w-full bg-[#F8F9FA] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      <div className="w-full max-w-md p-7 sm:p-9 rounded-3xl bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 transition-transform hover:scale-105 duration-200">
            <DocoraSymbol size={48} />
          </div>
          <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-neutral-900">
            Reset Password
          </h1>
          <p className="text-xs text-neutral-500 mt-1.5 tracking-normal">
            Enter your email to receive recovery instructions
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <span className="text-rose-500 font-bold shrink-0">•</span>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Instructions Dispatched</p>
                <p className="text-neutral-600 mt-1">{successInfo.message}</p>
              </div>
            </div>

            {successInfo.reset_token && (
              <div className="p-4 rounded-2xl bg-[#F4F5F7] border border-black/[0.08]">
                <p className="text-xs font-semibold text-amber-700 mb-1.5">Dev/Test Recovery Token:</p>
                <p className="text-[11px] font-mono break-all text-neutral-800 bg-white p-2.5 rounded-lg select-all border border-black/[0.08]">
                  {successInfo.reset_token}
                </p>
                <div className="mt-3">
                  <Link
                    href={`/reset-password?token=${encodeURIComponent(successInfo.reset_token)}`}
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 text-xs text-amber-700 font-semibold hover:underline"
                  >
                    Proceed directly to Reset Password screen →
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                prefetch={false}
                className="text-xs text-amber-700 hover:text-amber-800 font-semibold"
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
                className="block text-[11px] font-semibold uppercase tracking-wider text-neutral-600 mb-1.5"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F4F5F7] border border-black/[0.08] text-neutral-900 placeholder-neutral-400 text-xs focus:outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-500/20 transition-all"
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
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Link</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="mt-8 pt-5 border-t border-black/[0.08] text-center text-xs text-neutral-600">
              Remembered your password?{" "}
              <Link
                href="/login"
                prefetch={false}
                className="text-amber-700 font-semibold hover:underline ml-1"
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
