import { resolveSiteUrl, siteHostname } from "@/lib/siteUrl";

type AccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

/** Signed for tycoonworld.xyz (Farcaster account association). */
const TYCOONWORLD_ACCOUNT_ASSOCIATION: AccountAssociation = {
  header:
    "eyJmaWQiOjExMTc2NDIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhjNTVGMGU4MzE5M0M5QkRiMmQ5QjE1QTRiQUQyZkVFNjJiNUY2NGQ5In0",
  payload: "eyJkb21haW4iOiJ0eWNvb253b3JsZC54eXoifQ",
  signature:
    "xDWXI7kLJTTi5W8+gxrolkN5OMxNVMLON22SZUd8xTVgAcBizVpGh3mzVETaZ+fHwNlFdYSbMqaN4c2it2n/vxw=",
};

/** playtycoon.xyz — set in Vercel after signing at Farcaster Mini App manifest tools. */
function playtycoonAccountAssociation(): AccountAssociation | undefined {
  const header = process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_HEADER?.trim();
  const payload = process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_PAYLOAD?.trim();
  const signature = process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_SIGNATURE?.trim();
  if (!header || !payload || !signature) return undefined;
  return { header, payload, signature };
}

const ACCOUNT_ASSOCIATIONS: Record<string, AccountAssociation | (() => AccountAssociation | undefined)> = {
  "tycoonworld.xyz": TYCOONWORLD_ACCOUNT_ASSOCIATION,
  "playtycoon.xyz": playtycoonAccountAssociation,
};

function resolveAccountAssociation(hostname: string): AccountAssociation {
  const key = hostname.replace(/^www\./, "");
  const entry = ACCOUNT_ASSOCIATIONS[key];
  if (typeof entry === "function") {
    const fromEnv = entry();
    if (fromEnv) return fromEnv;
  } else if (entry) {
    return entry;
  }
  return TYCOONWORLD_ACCOUNT_ASSOCIATION;
}

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export function getMinikitConfig(baseUrl?: string) {
  const rootUrl = resolveSiteUrl(baseUrl);
  const hostname = siteHostname(rootUrl);
  const accountAssociation = resolveAccountAssociation(hostname);

  return {
    accountAssociation,
    miniapp: {
      version: "1",
      name: "Tycoon",
      subtitle: "monopoly mini app",
      description: "Ads",
      screenshotUrls: [`${rootUrl}/image.png`],
      iconUrl: `${rootUrl}/logo.png`,
      splashImageUrl: `${rootUrl}/logo.png`,
      splashBackgroundColor: "#000000",
      homeUrl: rootUrl,
      webhookUrl: `${rootUrl}/api/webhook`,
      primaryCategory: "games",
      tags: ["marketing", "ads", "quickstart", "waitlist"],
      heroImageUrl: `${rootUrl}/logo.png`,
      tagline: "",
      ogTitle: "",
      ogDescription: "",
      ogImageUrl: `${rootUrl}/logo.png`,
    },
  } as const;
}

/** Build-time default (playtycoon.xyz or NEXT_PUBLIC_URL). */
export const minikitConfig = getMinikitConfig();
