// clients/HomeClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/components/useMediaQuery";

/** Hero pulls wagmi + contracts — separate chunk; SSR LCP shell covers first paint. */
const HeroSection = dynamic(() => import("@/components/guest/HeroSection"), {
  ssr: false,
  loading: () => null,
});
const HeroSectionMobile = dynamic(() => import("@/components/guest/HeroSection-mobile"), {
  ssr: false,
  loading: () => null,
});

const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  loading: () => (
    <section
      className="relative h-[856px] min-h-[856px] w-full overflow-hidden bg-[#010F10]"
      aria-hidden
    >
      {/* Matches layout.tsx preload URL — paints LCP before the HowItWorks chunk loads */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/howItWorksBg1.png"
        alt=""
        width={2000}
        height={1500}
        fetchPriority="high"
        decoding="async"
        sizes="(max-width: 640px) 480px, (max-width: 1024px) 768px, 100vw"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </section>
  ),
});

const WhatIsTycoon = dynamic(() => import("@/components/guest/WhatIsTycoon"), {
  loading: () => <div className="min-h-[320px] w-full bg-[#010F10]" aria-hidden />,
});

const JoinOurCommunity = dynamic(() => import("@/components/guest/JoinOurCommunity"), {
  ssr: false,
  loading: () => <div className="min-h-[280px] w-full bg-[#010F10]" aria-hidden />,
});

const Footer = dynamic(() => import("@/components/shared/Footer"), {
  ssr: false,
  loading: () => <div className="min-h-[120px] w-full bg-[#010F10]" aria-hidden />,
});

export default function HomeClient() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <main className="w-full">
      {isMobile ? <HeroSectionMobile /> : <HeroSection />}
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}
