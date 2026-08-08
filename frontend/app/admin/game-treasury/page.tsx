"use client";

import GameProxyTreasurySection from "@/components/admin/GameProxyTreasurySection";

export default function AdminGameTreasuryPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Game proxy treasury</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        Rescue stranded ERC-20s (e.g. USDT) from the Tycoon UUPS game proxy. Connect the contract
        owner wallet on Celo mainnet and choose the destination address.
      </p>
      <div className="mt-8">
        <GameProxyTreasurySection />
      </div>
    </div>
  );
}
