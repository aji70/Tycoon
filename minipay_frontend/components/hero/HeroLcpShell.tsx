import { NeonTitle } from "@/components/hero/NeonTitle";

/**
 * Server-rendered LCP shell — paints "TYCOON" in the initial HTML before
 * client hero chunks (wagmi, framer-motion, TypeAnimation) hydrate.
 */
export default function HeroLcpShell() {
  return (
    <div
      id="hero-lcp-shell"
      className="pointer-events-none fixed inset-0 z-[15] flex flex-col items-center justify-center bg-[#010F10] px-4 pt-20 md:pt-0"
      aria-hidden="true"
    >
      <div className="h-8 w-full max-w-lg md:h-10" />
      <NeonTitle text="TYCOON" size="lg" />
    </div>
  );
}
