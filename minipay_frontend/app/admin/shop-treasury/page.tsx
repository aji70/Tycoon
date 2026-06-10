"use client";

import RewardTreasurySection from "@/components/admin/RewardTreasurySection";

export default function AdminShopTreasuryPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">Shop treasury</h1>
      <p className="mt-1 text-sm text-slate-400 max-w-2xl">
        View perk-shop balances on the reward contract and withdraw to a preferred address. Connect the contract owner wallet on Celo mainnet.
      </p>
      <div className="mt-8">
        <RewardTreasurySection />
      </div>
    </div>
  );
}
