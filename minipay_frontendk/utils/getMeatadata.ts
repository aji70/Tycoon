import type { Metadata } from "next";
import { resolveSiteUrl, resolveMetadataBase } from "@/lib/siteUrl";

const titleTemplate = "%s | Tycoon";

const defaultDescription =
  "Tycoon is a Monopoly-style on-chain board game on Celo. Play vs friends or AI, trade properties, build empires, and win real prizes — right in MiniPay.";

/**
 * Generates metadata for a given page.
 */
export const getMetadata = ({
  title,
  description,
  imageRelativePath = "/thumbnail.png",
}: {
  title: string;
  description: string;
  imageRelativePath?: string;
  other?: Record<string, unknown>;
}): Metadata => {
  const baseUrl = resolveSiteUrl();
  const imageUrl = `${baseUrl}${imageRelativePath}`;

  return {
    generator: "Tycoon",
    applicationName: "Tycoon",
    referrer: "origin-when-cross-origin",
    keywords: [
      "tycoon",
      "monopoly",
      "onchain game",
      "celo",
      "minipay",
      "decentralized gaming",
      "blockchain games",
      "digital properties",
      "buy sell trade properties",
      "onchain monopoly game",
    ],
    creator: "Tycoon Team",
    publisher: "Ajidokwu",
    metadataBase: resolveMetadataBase(),
    manifest: `${baseUrl}/manifest.json`,
    alternates: {
      canonical: baseUrl,
    },
    robots: {
      index: false,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: false,
        noimageindex: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    title: {
      default: title,
      template: titleTemplate,
    },
    description: description,
    openGraph: {
      title: {
        default: title,
        template: titleTemplate,
      },
      description: defaultDescription,
      images: [
        {
          url: imageUrl,
          alt: "Tycoon - Monopoly on Celo",
        },
      ],
      type: "website",
      siteName: "Tycoon",
      locale: "en_US",
      url: baseUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: {
        default: title,
        template: titleTemplate,
      },
      description: defaultDescription,
      creator: "@Tycoon",
      images: [
        {
          url: imageUrl,
          alt: "Tycoon - Monopoly on Celo",
        },
      ],
    },
    icons: {
      icon: [
        {
          url: `/metadata/favicon-32x32.png`,
          sizes: "32x32",
          type: "image/png",
        },
        {
          url: `/metadata/favicon-16x16.png`,
          sizes: "16x16",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-192x192.png`,
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-512x512.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: `/metadata/apple-touch-icon.png`,
          sizes: "180x180",
          type: "image/png",
        },
      ],
      shortcut: [
        {
          url: `/metadata/favicon.ico`,
          sizes: "48x48",
          type: "image/x-icon",
        },
      ],
      other: [
        {
          url: `/metadata/android-chrome-192x192.png`,
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: `/metadata/android-chrome-512x512.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  };
};
