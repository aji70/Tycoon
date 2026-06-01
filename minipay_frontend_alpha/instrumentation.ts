import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV ?? "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      });
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
