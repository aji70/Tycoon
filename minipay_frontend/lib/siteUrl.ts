/** Canonical MiniPay origin: env first, localhost in dev, else playtycoon.xyz. */
export function resolveSiteUrl(override?: string): string {
  const trimmed = override?.trim().replace(/\/$/, "");
  if (trimmed) return trimmed;

  const fromEnv = process.env.NEXT_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");

  if (process.env.NODE_ENV === "development") return "http://localhost:3000";

  return "https://playtycoon.xyz";
}

/** Hostname without www — used to pick Farcaster accountAssociation. */
export function siteHostname(siteUrl: string): string {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    return "playtycoon.xyz";
  }
}

export function resolveMetadataBase(siteUrl?: string): URL {
  const fallback = "https://playtycoon.xyz";
  const candidate = resolveSiteUrl(siteUrl);
  try {
    if (/^https?:\/\//i.test(candidate)) {
      return new URL(candidate);
    }
    return new URL(`https://${candidate}`);
  } catch {
    return new URL(fallback);
  }
}
