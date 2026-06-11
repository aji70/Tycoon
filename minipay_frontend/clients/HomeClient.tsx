// clients/HomeClient.tsx
"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/components/useMediaQuery";

/** Hero pulls wagmi + contracts — separate chunk; SSR LCP shell covers first paint. */
const HeroSection = dynamic(() => import("@/components/guest/HeroSection"), {
  loading: () => null,
});
const HeroSectionMobile = dynamic(() => import("@/components/guest/HeroSection-mobile"), {
  loading: () => null,
});

const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  loading: () => <div className="min-h-[856px] w-full bg-[#010F10]" aria-hidden />,
});

const WhatIsTycoon = dynamic(() => import("@/components/guest/WhatIsTycoon"), {
  loading: () => <div className="min-h-[320px] w-full bg-[#010F10]" aria-hidden />,
});

const JoinOurCommunity = dynamic(() => import("@/components/guest/JoinOurCommunity"), {
  loading: () => <div className="min-h-[280px] w-full bg-[#010F10]" aria-hidden />,
});

const Footer = dynamic(() => import("@/components/shared/Footer"), {
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
