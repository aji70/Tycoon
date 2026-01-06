"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import components to avoid SSR issues with media queries
const GameWaiting = dynamic(() => import("@/components/settings/game-waiting"), {
  ssr: false,
});

const GameWaitingMobile = dynamic(() => import("@/components/settings/game-waiting-mobile"), {
  ssr: false,
});

// Fallback loading component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-settings bg-cover bg-fixed flex items-center justify-center">
      <p className="text-[#00F0FF] text-3xl font-orbitron animate-pulse tracking-wider">
        ENTERING LOBBY...
      </p>
    </div>
  );
}

export default function GameWaitingClient() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      {/* 
        We use dynamic imports with ssr: false because both GameWaiting 
        and GameWaitingMobile are client-only (they use window, media queries, etc.)
        Suspense ensures we show a nice loader while components load/hydrate
      */}
      <>
        {/* Desktop Version - Hidden on mobile */}
        <div className="hidden md:block">
          <GameWaiting />
        </div>

        {/* Mobile Version - Hidden on desktop */}
        <div className="block md:hidden">
          <GameWaitingMobile />
        </div>
      </>
    </Suspense>
  );
}