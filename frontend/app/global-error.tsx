"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

const DEFAULT_DESCRIPTION =
  "Tycoon is a decentralized on-chain game inspired by Monopoly, built on Celo. Buy, sell, and trade digital properties in a trustless gaming environment.";

/**
 * Renders when the root layout throws — it replaces the entire document, so this
 * file must supply lang, title, meta description, and a main landmark (SEO + a11y).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Tycoon — Something went wrong</title>
        <meta name="description" content={DEFAULT_DESCRIPTION} />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#010F10",
          color: "#E0F7F8",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          id="main-content"
          className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-6 py-12 text-center"
        >
          <h1 className="text-2xl font-semibold tracking-tight text-cyan-300">
            Something went wrong
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">{DEFAULT_DESCRIPTION}</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-[#010F10] transition hover:bg-cyan-300"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
