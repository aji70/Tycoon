"use client";

import React, { useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Gamepad2,
  Dices,
  Landmark,
  Home,
  Train,
  Zap,
  Scale,
  BookOpen,
  ArrowLeft,
  Banknote,
  Building2,
  HandCoins,
  CircleAlert,
  Trophy,
} from "lucide-react";

export default function HowToPlayPage() {
  const router = useRouter();
  const navigatingRef = useRef(false);

  const handleBack = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    } catch {
      router.push("/");
    } finally {
      setTimeout(() => {
        navigatingRef.current = false;
      }, 500);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#010F10] text-[#F0F7F7]">
      {/* Top bar */}
      <div className="sticky top-0 z-20 border-b border-[#003B3E]/60 bg-[#010F10]/95 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#00F0FF] hover:text-[#00F0FF]/80 font-dmSans text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <span className="game-badge text-xs">RULES</span>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-4 py-8 pb-16">
        {/* Hero */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 p-3">
              <BookOpen className="w-8 h-8 text-[#00F0FF]" />
            </div>
            <h1 className="font-orbitron text-3xl md:text-4xl font-bold text-white">
              How to Play Tycoon
            </h1>
          </div>
          <p className="text-[#E0F7F8] font-dmSans text-lg leading-relaxed">
            Tycoon is a Monopoly-style board game on the blockchain. Roll the dice, buy properties, collect rent, build houses and hotels, and bankrupt your opponents to win.
          </p>
        </header>

        {/* Table of contents */}
        <nav className="mb-12 rounded-2xl border border-[#003B3E] bg-[#0B191A]/60 p-6">
          <h2 className="font-orbitron text-sm font-semibold text-[#00F0FF] uppercase tracking-wider mb-4">
            On this page
          </h2>
          <ul className="space-y-2 font-dmSans text-sm text-[#E0F7F8]">
            <li><a href="#overview" className="hover:text-[#00F0FF] transition-colors">Overview</a></li>
            <li><a href="#board" className="hover:text-[#00F0FF] transition-colors">The board</a></li>
            <li><a href="#setup" className="hover:text-[#00F0FF] transition-colors">Game setup</a></li>
            <li><a href="#turns" className="hover:text-[#00F0FF] transition-colors">Turns & movement</a></li>
            <li><a href="#buying" className="hover:text-[#00F0FF] transition-colors">Buying properties</a></li>
            <li><a href="#rent" className="hover:text-[#00F0FF] transition-colors">Rent</a></li>
            <li><a href="#building" className="hover:text-[#00F0FF] transition-colors">Houses & hotels</a></li>
            <li><a href="#mortgage" className="hover:text-[#00F0FF] transition-colors">Mortgage</a></li>
            <li><a href="#cards" className="hover:text-[#00F0FF] transition-colors">Chance & Community Chest</a></li>
            <li><a href="#jail" className="hover:text-[#00F0FF] transition-colors">Jail</a></li>
            <li><a href="#trading" className="hover:text-[#00F0FF] transition-colors">Trading</a></li>
            <li><a href="#winning" className="hover:text-[#00F0FF] transition-colors">Bankruptcy & winning</a></li>
          </ul>
        </nav>

        <div className="space-y-14">
          {/* Overview */}
          <section id="overview">
            <div className="flex items-center gap-3 mb-4">
              <Gamepad2 className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Overview</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              Tycoon is played on a 40-space board. Each player starts with <strong className="text-white">$1,500</strong> and a token on <strong className="text-white">GO</strong>. On your turn you roll two dice, move your token, and follow the rules for the space you land on. You can buy unowned properties, pay rent to owners, build houses and hotels on color sets, and trade with other players. The last player with money and assets wins.
            </p>
          </section>

          {/* The board */}
          <section id="board">
            <div className="flex items-center gap-3 mb-4">
              <Landmark className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">The board</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              The board has 40 spaces (0–39). Key spaces:
            </p>
            <ul className="space-y-2 font-dmSans text-[#E0F7F8] mb-4 list-disc list-inside">
              <li><strong className="text-white">GO (0)</strong> — Start here. Collect $200 when you pass or land on it.</li>
              <li><strong className="text-white">Properties</strong> — Colored groups (brown, light blue, pink, orange, red, yellow, green, dark blue). You can buy them, charge rent, and build houses/hotels when you own a full set.</li>
              <li><strong className="text-white">Railroads (5, 15, 25, 35)</strong> — Special spaces. Rent depends on how many railroads the owner has (1 = $25, 2 = $50, 3 = $100, 4 = $200).</li>
              <li><strong className="text-white">Utilities (12, 28)</strong> — Electric Company & Water Works. Rent = dice roll × 4 (one utility) or × 10 (both).</li>
              <li><strong className="text-white">Chance (7, 22, 36)</strong> — Draw a Chance card (move, pay, receive, or special effect).</li>
              <li><strong className="text-white">Community Chest (2, 17, 33)</strong> — Draw a Community Chest card.</li>
              <li><strong className="text-white">Income Tax (4)</strong> — Pay $100 to the bank.</li>
              <li><strong className="text-white">Luxury Tax (38)</strong> — Pay $100 to the bank.</li>
              <li><strong className="text-white">Visiting Jail (10)</strong> — No effect; you’re just visiting.</li>
              <li><strong className="text-white">Go to Jail (30)</strong> — Move to Jail (space 10); you do not collect $200.</li>
              <li><strong className="text-white">Free Parking (20)</strong> — No effect.</li>
            </ul>
          </section>

          {/* Game setup */}
          <section id="setup">
            <div className="flex items-center gap-3 mb-4">
              <Banknote className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Game setup</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              Each player starts with <strong className="text-white">$1,500</strong> and their token on <strong className="text-white">GO</strong>. Players take turns in order. In multiplayer you can create a game and invite friends with a 6-letter code, or join an existing game. In solo mode you play against AI opponents.
            </p>
          </section>

          {/* Turns & movement */}
          <section id="turns">
            <div className="flex items-center gap-3 mb-4">
              <Dices className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Turns & movement</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              On your turn:
            </p>
            <ol className="space-y-2 font-dmSans text-[#E0F7F8] mb-4 list-decimal list-inside">
              <li><strong className="text-white">Roll</strong> — Roll two dice. If you roll double 6 (total 12), you roll again and do not move.</li>
              <li><strong className="text-white">Move</strong> — Your token advances by the dice total (2–11). If you pass GO, collect <strong className="text-white">$200</strong>.</li>
              <li><strong className="text-white">Land action</strong> — Do what the space says: buy property, pay rent, pay tax, draw a card, or go to jail.</li>
              <li><strong className="text-white">Optional actions</strong> — You can build houses/hotels, mortgage or unmortgage, and propose trades during your turn.</li>
              <li><strong className="text-white">End turn</strong> — Pass the turn to the next player.</li>
            </ol>
          </section>

          {/* Buying properties */}
          <section id="buying">
            <div className="flex items-center gap-3 mb-4">
              <Home className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Buying properties</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              When you land on an <strong className="text-white">unowned</strong> property (including railroads and utilities), you may buy it from the bank at its listed price. If you don’t buy it, it may go to auction (if that option is enabled in game settings). Once you own a property, other players must pay you rent when they land on it (unless it’s mortgaged).
            </p>
          </section>

          {/* Rent */}
          <section id="rent">
            <div className="flex items-center gap-3 mb-4">
              <HandCoins className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Rent</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              When you land on a property owned by another player, you pay rent. <strong className="text-white">Mortgaged properties charge no rent.</strong>
            </p>
            <div className="rounded-xl border border-[#003B3E] bg-[#0B191A]/60 p-5 space-y-4">
              <div>
                <h3 className="font-orbitron text-sm font-semibold text-[#00F0FF] mb-2">Colored properties</h3>
                <p className="font-dmSans text-sm text-[#E0F7F8]">
                  Rent depends on how many houses (or hotel) are on that property: 0 = base rent (site only), 1–4 houses = higher rent, 5 = hotel (highest rent). Each property has its own rent values shown on the card.
                </p>
              </div>
              <div>
                <h3 className="font-orbitron text-sm font-semibold text-[#00F0FF] mb-2 flex items-center gap-2">
                  <Train className="w-4 h-4" /> Railroads
                </h3>
                <p className="font-dmSans text-sm text-[#E0F7F8]">
                  1 railroad = $25 · 2 = $50 · 3 = $100 · 4 = $200
                </p>
              </div>
              <div>
                <h3 className="font-orbitron text-sm font-semibold text-[#00F0FF] mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Utilities
                </h3>
                <p className="font-dmSans text-sm text-[#E0F7F8]">
                  If the owner has one utility: rent = <strong className="text-white">4 × your dice roll</strong>. If they own both: <strong className="text-white">10 × your dice roll</strong>. (e.g. roll 7, they own both → $70.)
                </p>
              </div>
            </div>
          </section>

          {/* Houses & hotels */}
          <section id="building">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Houses & hotels</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              You can build houses (and a hotel) only when you own <strong className="text-white">every property in a color group</strong> (a monopoly). Each house costs the amount shown for that group (e.g. $50–$200 per house). You add one house at a time. A hotel counts as the 5th level. You cannot build on mortgaged properties or while in jail. Selling buildings back to the bank gives you half the build cost per house/hotel.
            </p>
          </section>

          {/* Mortgage */}
          <section id="mortgage">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Mortgage</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              To get quick cash, you can <strong className="text-white">mortgage</strong> a property that has no houses or hotels. You receive <strong className="text-white">half its price</strong> from the bank. While mortgaged, that property charges <strong className="text-white">no rent</strong>. To unmortgage, pay the bank the <strong className="text-white">full price</strong> (not 110%). You cannot mortgage or unmortgage while in jail.
            </p>
          </section>

          {/* Chance & Community Chest */}
          <section id="cards">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Chance & Community Chest</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              When you land on Chance or Community Chest, you draw a card. Cards can make you move (e.g. advance to GO, go to a railroad, go to jail), pay or receive money, or have special effects (e.g. Get Out of Jail Free). Follow the card, then your turn continues as normal (e.g. if you’re sent to another space, you may buy or pay rent there).
            </p>
          </section>

          {/* Jail */}
          <section id="jail">
            <div className="flex items-center gap-3 mb-4">
              <CircleAlert className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Jail</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              You go to Jail by landing on <strong className="text-white">Go to Jail (30)</strong> or drawing a “Go to Jail” card. You do not collect $200 when sent to jail. On your turn while in jail you roll the dice. You get out by (1) rolling <strong className="text-white">doubles</strong>, (2) rolling a <strong className="text-white">12</strong>, or (3) after your <strong className="text-white">third turn</strong> in jail (you must then pay or use a Get Out of Jail Free card if you have one). While in jail you cannot build, mortgage, or unmortgage.
            </p>
          </section>

          {/* Trading */}
          <section id="trading">
            <div className="flex items-center gap-3 mb-4">
              <HandCoins className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Trading</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              During your turn you can propose trades to other players: offer cash and/or properties in exchange for their cash and/or properties. If they accept, the trade is executed. Trading is a great way to complete color sets so you can build houses.
            </p>
          </section>

          {/* Bankruptcy & winning */}
          <section id="winning">
            <div className="flex items-center gap-3 mb-4">
              <Trophy className="w-6 h-6 text-[#00F0FF]" />
              <h2 className="font-orbitron text-2xl font-bold text-white">Bankruptcy & winning</h2>
            </div>
            <p className="font-dmSans text-[#E0F7F8] leading-relaxed mb-4">
              If you owe rent, tax, or a card payment and cannot pay (even by selling buildings, mortgaging, or trading), you are <strong className="text-white">bankrupt</strong>. You leave the game and your properties return to the bank (unmortgaged, no buildings). The last player left in the game wins. In timed or AI games, the winner can also be determined by <strong className="text-white">highest net worth</strong> (cash + property values + building values) when time runs out.
            </p>
          </section>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-[#00F0FF]/30 bg-[#00F0FF]/5 p-8 text-center">
          <p className="font-dmSans text-[#E0F7F8] mb-6">
            Ready to roll? Create a game, join with a code, or challenge the AI.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00F0FF] text-[#010F10] font-orbitron font-bold hover:bg-[#00F0FF]/90 transition-colors"
          >
            <Gamepad2 className="w-5 h-5" />
            Play Tycoon
          </Link>
        </div>
      </article>
    </div>
  );
}
