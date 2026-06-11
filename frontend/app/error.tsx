"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Catches errors in the root segment (below the root layout). Root layout metadata
 * still applies; this supplies a single main landmark for assistive tech.
 */
export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-[#010F10] px-6 py-16 text-center"
    >
      <h1 className="text-2xl font-semibold text-cyan-300">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-400">
        A quick reset usually fixes it. If this keeps happening, try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-6 py-2.5 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
      >
        Try again
      </button>
    </main>
  );
}
