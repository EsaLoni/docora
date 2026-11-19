"use client";

import React, { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { Mail, ArrowRight, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";
import { Button, Input } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ message: string; reset_token?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMessage("Enter your registered email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage("Enter a valid email address (e.g. researcher@institution.edu).");
      return;
    }

    setIsLoading(true);
    try {
      const res = await apiClient.forgotPassword(trimmed);
      setSuccessInfo({
        message: res.message || "A recovery link has been dispatched to your email address.",
        reset_token: res.reset_token,
      });
    } catch (err: any) {
      if (err.status === 404) {
        setErrorMessage("No account exists with this email address.");
      } else if (err.status === 429) {
        setErrorMessage("Too many reset attempts. Please wait 5 minutes before trying again.");
      } else {
        setErrorMessage(err.message || "Unable to process password reset request. Verify connection.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col items-center justify-center p-4 relative font-sans select-none">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-lg bg-surface border border-border-hairline shadow-sm relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center mb-3">
            <DocoraSymbol size={40} />
          </div>
          <h1 className="font-serif text-title sm:text-display font-medium tracking-tight text-ink">
            Reset Password
          </h1>
          <p className="text-caption text-ink-secondary mt-1">
            Enter your email to receive recovery instructions.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-caption flex items-start gap-2">
            <span className="font-bold shrink-0">•</span>
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successInfo ? (
          <div className="space-y-4">
            <div className="p-4 rounded-md bg-surface-subtle border border-border-hairline text-ui flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-verdigris" />
              <div>
                <p className="font-medium text-ink">Recovery Link Dispatched</p>
                <p className="text-caption text-ink-secondary mt-1">{successInfo.message}</p>
              </div>
            </div>

            {successInfo.reset_token && (
              <div className="p-3.5 rounded-md bg-surface-subtle border border-border-hairline space-y-2">
                <p className="text-caption font-medium text-ink">Dev/Test Recovery Token:</p>
                <p className="text-micro font-mono break-all text-ink bg-surface p-2 rounded-sm border border-border-hairline select-all">
                  {successInfo.reset_token}
                </p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(successInfo.reset_token)}`}
                  prefetch={false}
                  className="inline-flex items-center gap-1.5 text-caption text-gold hover:underline"
                >
                  Proceed to Reset Password screen →
                </Link>
              </div>
            )}

            <div className="pt-2 text-center">
              <Link
                href="/login"
                prefetch={false}
                className="text-caption text-ink-secondary hover:text-ink transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-caption font-medium text-ink-secondary"
              >
                Account Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="name@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading}
              className="w-full gap-2 justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Link...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Instructions</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                prefetch={false}
                className="text-caption text-ink-secondary hover:text-ink transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
