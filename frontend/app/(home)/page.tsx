import HeroSection from "@/components/guest/HeroSection";
import HeroSectionMobile from "@/components/guest/HeroSection-mobile";
import HowItWorks from "@/components/guest/HowItWorks";
import JoinOurCommunity from "@/components/guest/JoinOurCommunity";
import WhatIsTycoon from "@/components/guest/WhatIsTycoon";
import Footer from "@/components/shared/Footer";
import { useMediaQuery } from "@/components/useMediaQuery";


export default function Home() {
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
