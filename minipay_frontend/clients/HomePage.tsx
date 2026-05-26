"use client";

import dynamic from "next/dynamic";
import { useEffect, type ReactNode } from "react";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import Footer from "@/components/shared/Footer";
import { useWeb3Ready } from "@/context/Web3ReadyContext";
import { dismissHeroLcpShell } from "@/lib/dismissHeroLcpShell";

const HeroSection = dynamic(() => import("@/components/guest/HeroSection"), {
  ssr: false,
});
const HeroSectionMobile = dynamic(() => import("@/components/guest/HeroSection-mobile"), {
  ssr: false,
});

const HowItWorks = dynamic(() => import("@/components/guest/HowItWorks"), {
  loading: () => <div className="min-h-[856px] w-full bg-[#010F10]" aria-hidden />,
});

function InteractiveHero() {
  useEffect(() => {
    dismissHeroLcpShell();
  }, []);

  return (
    <>
      <div className="hidden md:block">
        <HeroSection />
      </div>
      <div className="md:hidden">
        <HeroSectionMobile />
      </div>
    </>
  );
}

type Props = {
  lcpShell: ReactNode;
};

export default function HomePage({ lcpShell }: Props) {
  const web3Ready = useWeb3Ready();

  return (
    <main className="w-full">
      {web3Ready ? <InteractiveHero /> : lcpShell}
      <WhatIsTycoon />
      <HowItWorks />
      <JoinOurCommunity />
      <Footer />
    </main>
  );
}
