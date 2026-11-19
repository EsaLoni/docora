"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-lg border border-border-hairline bg-surface text-center space-y-3 my-4 font-sans">
          <div className="h-9 w-9 mx-auto rounded-md bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="h-4 w-4" />
          </div>
          <h3 className="font-serif text-title font-medium text-ink">
            {this.props.fallbackTitle || "Unable to load this section"}
          </h3>
          <p className="text-caption text-ink-secondary max-w-sm mx-auto">
            {this.props.fallbackMessage || "An unexpected error occurred while rendering this view. Your session data is intact."}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reload View</span>
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
