import Image from "next/image";
import Link from "next/link";
import herobg from "@/public/heroBg.png";
import { kronaOne, orbitron, dmSans } from "@/components/shared/fonts";
import MountWeb3Button from "@/components/hero/MountWeb3Button";

/**
 * Server-rendered hero shell so LCP (TYCOON title) paints in the initial HTML
 * without waiting for Privy/wagmi/Framer Motion. Dismissed when the interactive hero mounts.
 */
export default function HeroLcpShell() {
  return (
    <section
      id="hero-lcp-shell"
      className={`relative min-h-screen min-h-[100dvh] w-full overflow-hidden bg-[#010F10] ${kronaOne.variable} ${orbitron.variable} ${dmSans.variable}`}
      aria-label="Tycoon"
    >
      <div className="absolute inset-0 z-0">
        <Image
          src={herobg}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={75}
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#010F10]/40 via-transparent to-[#010F10]/90"
          aria-hidden
        />
      </div>

      <div className="relative z-10 flex min-h-screen min-h-[100dvh] flex-col items-center justify-center gap-4 px-4 pt-20 pb-16 md:pt-16">
        <p className="font-orbitron text-center text-lg font-bold text-[#F0F7F7] md:text-2xl lg:text-[40px]">
          Conquer • Build • Trade On
        </p>

        <h1
          className="font-kronaOne hidden text-7xl font-bold uppercase tracking-tighter text-[#00F0FF] md:block md:text-8xl lg:text-9xl"
          style={{
            textShadow:
              "0 0 8px rgba(0, 240, 255, 0.8), 0 0 16px rgba(0, 240, 255, 0.6)",
          }}
        >
          TYCOON
        </h1>
        <h1
          className="font-kronaOne text-6xl font-bold uppercase tracking-tighter text-[#00F0FF] md:hidden sm:text-7xl"
          style={{
            textShadow:
              "0 0 8px rgba(0, 240, 255, 0.8), 0 0 16px rgba(0, 240, 255, 0.6)",
          }}
        >
          TYCOON
        </h1>

        <p className="max-w-xl text-center font-dmSans text-sm text-[#F0F7F7] md:text-lg">
          On-chain Monopoly on Celo — roll, buy, trade, and become the ultimate blockchain tycoon.
        </p>

        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/play-ai-3d"
            className="rounded-xl border-2 border-[#00F0FF] bg-[#00F0FF]/10 px-6 py-3 font-orbitron text-sm font-bold text-[#00F0FF] transition hover:bg-[#00F0FF]/20"
          >
            Play vs AI
          </Link>
          <Link
            href="/rooms"
            className="rounded-xl border border-[#003B3E] bg-[#0E1415] px-6 py-3 font-orbitron text-sm font-semibold text-[#F0F7F7] transition hover:border-[#00F0FF]/50"
          >
            Join a room
          </Link>
          <MountWeb3Button />
        </div>
      </div>
    </section>
  );
}
