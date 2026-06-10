import { resolveSiteUrl } from "@/lib/siteUrl";

type AccountAssociation = {
  header: string;
  payload: string;
  signature: string;
};

/** Set in Vercel after signing playtycoon.xyz at Farcaster Mini App manifest tools. */
function resolveAccountAssociation(): AccountAssociation {
  const header =
    process.env.NEXT_PUBLIC_FC_ASSOC_HEADER?.trim() ||
    process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_HEADER?.trim() ||
    "";
  const payload =
    process.env.NEXT_PUBLIC_FC_ASSOC_PAYLOAD?.trim() ||
    process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_PAYLOAD?.trim() ||
    "";
  const signature =
    process.env.NEXT_PUBLIC_FC_ASSOC_SIGNATURE?.trim() ||
    process.env.NEXT_PUBLIC_PLAYTYCOON_FC_ASSOC_SIGNATURE?.trim() ||
    "";

  return { header, payload, signature };
}

const TYCOON_DESCRIPTION =
  "Tycoon is a Monopoly-style board game on Celo. Buy properties, collect rent, build monopolies, trade with friends or AI, and compete for on-chain prizes — playable in MiniPay.";

const TYCOON_TAGLINE = "Roll. Buy. Build. Win on-chain.";

/**
 * MiniApp configuration for playtycoon.xyz.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export function getMinikitConfig(baseUrl?: string) {
  const rootUrl = resolveSiteUrl(baseUrl);
  const accountAssociation = resolveAccountAssociation();

  return {
    accountAssociation,
    miniapp: {
      version: "1",
      name: "Tycoon",
      subtitle: "Monopoly on Celo",
      description: TYCOON_DESCRIPTION,
      screenshotUrls: [`${rootUrl}/image.png`, `${rootUrl}/screenshot.png`],
      iconUrl: `${rootUrl}/logo.png`,
      splashImageUrl: `${rootUrl}/logo.png`,
      splashBackgroundColor: "#010F10",
      homeUrl: rootUrl,
      webhookUrl: `${rootUrl}/api/webhook`,
      primaryCategory: "games",
      tags: ["games", "monopoly", "celo", "minipay", "web3", "strategy"],
      heroImageUrl: `${rootUrl}/logo.png`,
      tagline: TYCOON_TAGLINE,
      ogTitle: "Tycoon — Monopoly on Celo",
      ogDescription: TYCOON_DESCRIPTION,
      ogImageUrl: `${rootUrl}/logo.png`,
    },
  } as const;
}

/** Default manifest for playtycoon.xyz (or NEXT_PUBLIC_URL). */
export const minikitConfig = getMinikitConfig();
