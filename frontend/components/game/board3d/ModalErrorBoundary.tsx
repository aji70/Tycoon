"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional title when showing default fallback (e.g. "Something went wrong loading the room.") */
  fallbackTitle?: string;
  /** Optional subtext (e.g. "Try refreshing the page.") */
  fallbackSubtext?: string;
  /** Show stack trace for debugging (e.g. rooms mobile crash) */
  showStack?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Catches errors in the Trades/Players modal so the app doesn't show the full "Application error" page. */
export default class ModalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ModalErrorBoundary] Trades/Players modal error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      const err = this.state.error;
      const message = err?.message ?? "Unknown error";
      const stack = err?.stack ?? "";
      const title = this.props.fallbackTitle ?? "Something went wrong opening this panel.";
      const subtext = this.props.fallbackSubtext ?? "Try closing and opening again, or refresh the page.";
      return (
        <div className="p-4 space-y-3 rounded-xl bg-slate-800/80 border border-amber-500/30">
          <p className="text-amber-200 font-medium">{title}</p>
          <p className="text-red-300/90 text-xs font-mono break-all">{message}</p>
          {this.props.showStack && stack && (
            <pre className="p-2 mt-2 bg-black/50 rounded text-amber-300/80 text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-auto">
              {stack}
            </pre>
          )}
          <p className="text-slate-400 text-sm">{subtext}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
