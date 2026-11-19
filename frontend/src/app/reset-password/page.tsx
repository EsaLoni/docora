"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Lock, Eye, EyeOff, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { DocoraSymbol } from "@/components/brand/BrandLogo";
import { Button, Input } from "@/components/ui";

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
      setErrorMessage("Reset token is required. Check your recovery link.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Verify both fields.");
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.resetPassword({ token: token.trim(), new_password: newPassword });
      setSuccess(true);
    } catch (err: any) {
      setErrorMessage(
        err.message || err.detail || "Unable to reset password. The link or token may be expired."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md p-6 sm:p-8 rounded-lg bg-surface border border-border-hairline shadow-sm relative z-10 text-center select-none">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-surface-subtle border border-border-hairline mb-3 text-verdigris">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h2 className="font-serif text-title sm:text-display font-medium text-ink">
          Password Updated
        </h2>
        <p className="text-caption text-ink-secondary mt-1.5 mb-6">
          Your password has been securely updated. You can now sign in with your new credentials.
        </p>
        <Link href="/login" prefetch={false} className="w-full block">
          <Button variant="primary" size="md" className="w-full gap-2 justify-center">
            <span>Continue to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md p-6 sm:p-8 rounded-lg bg-surface border border-border-hairline shadow-sm relative z-10 select-none">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center mb-3">
          <DocoraSymbol size={40} />
        </div>
        <h1 className="font-serif text-title sm:text-display font-medium tracking-tight text-ink">
          Set New Password
        </h1>
        <p className="text-caption text-ink-secondary mt-1">
          Enter your recovery token and select a new password.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-5 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-caption flex items-start gap-2">
          <span className="font-bold shrink-0">•</span>
          <span className="leading-relaxed">{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="token"
            className="block text-caption font-medium text-ink-secondary mb-1"
          >
            Reset Token
          </label>
          <Input
            id="token"
            type="text"
            required
            placeholder="Paste your token from recovery link"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="newPassword"
            className="block text-caption font-medium text-ink-secondary mb-1"
          >
            New Password
          </label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              required
              placeholder="Minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-ink-muted hover:text-ink transition-colors cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-caption font-medium text-ink-secondary mb-1"
          >
            Confirm New Password
          </label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            required
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
          />
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
              <span>Updating Password...</span>
            </>
          ) : (
            <>
              <span>Save New Password</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>

        <div className="pt-2 text-center">
          <Link
            href="/login"
            prefetch={false}
            className="text-caption text-ink-secondary hover:text-ink transition-colors"
          >
            Return to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col items-center justify-center p-4 relative font-sans">
      <Suspense
        fallback={
          <div className="w-full max-w-md p-8 rounded-lg bg-surface border border-border-hairline shadow-sm text-center">
            <Loader2 className="w-6 h-6 animate-spin text-ink-muted mx-auto" />
            <p className="text-caption text-ink-secondary mt-2">Loading reset form...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
