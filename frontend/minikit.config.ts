const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
  "header": "eyJmaWQiOjExMTc2NDIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhjNTVGMGU4MzE5M0M5QkRiMmQ5QjE1QTRiQUQyZkVFNjJiNUY2NGQ5In0",
    "payload": "eyJkb21haW4iOiJiYXNlLW1vbm9wb2x5LnZlcmNlbC5hcHAifQ",
    "signature": "uVixmExYSLDS1Tbozg2sK0Qiku0kuk0fR9iKs1K4zW8IiV66YQGmyYgnvHOQNDpvib8Mc+sQvPTNZsGewSaV2hs="
  },
  miniapp: {
    version: "1",
    name: "Tycoon", 
    subtitle: "monopoly mini app", 
    description: "Ads",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["marketing", "ads", "quickstart", "waitlist"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "",
    ogTitle: "",
    ogDescription: "",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

