"use client";

import React, { useState } from "react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Game, GameProperty, Player, Property } from "@/types/game";
import { ApiResponse } from "@/types/api";

interface RaiseFundsPanelProps {
  me: Player;
  game: Game;
  gameProperties: GameProperty[];
  properties: Property[];
  onRefetch: () => Promise<void>;
  onDeclareBankruptcy: () => Promise<void>;
  /** Extra bottom offset (e.g. "bottom-24" for mobile) – defaults to "bottom-4" */
  bottomClass?: string;
}

export default function RaiseFundsPanel({
  me,
  game,
  gameProperties,
  properties,
  onRefetch,
  onDeclareBankruptcy,
  bottomClass = "bottom-4",
}: RaiseFundsPanelProps) {
  const [busy, setBusy] = useState(false);
  const [declaringBankruptcy, setDeclaringBankruptcy] = useState(false);

  const myAddr = me.address?.toLowerCase();

  // Properties I own with houses/hotels
  const sellable = gameProperties
    .filter(
      (gp) =>
        gp.address?.toLowerCase() === myAddr &&
        !gp.mortgaged &&
        (gp.development ?? 0) > 0
    )
    .map((gp) => {
      const prop = properties.find((p) => p.id === gp.property_id);
      return { gp, prop };
    })
    .filter(({ prop }) => !!prop);

  // Unimproved, unmortgaged properties I can mortgage
  const mortgageable = gameProperties
    .filter(
      (gp) =>
        gp.address?.toLowerCase() === myAddr &&
        !gp.mortgaged &&
        (gp.development ?? 0) === 0
    )
    .map((gp) => {
      const prop = properties.find((p) => p.id === gp.property_id);
      return { gp, prop };
    })
    .filter(({ prop }) => !!prop);

  const canRaiseFunds = sellable.length > 0 || mortgageable.length > 0;

  const handleSellHouse = async (gp: GameProperty) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/downgrade", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: gp.property_id,
      });
      if (res.data?.success) {
        toast.success("House sold.");
        await onRefetch();
      } else {
        toast.error(res.data?.message ?? "Failed to sell house");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to sell house");
    } finally {
      setBusy(false);
    }
  };

  const handleMortgage = async (gp: GameProperty, prop: Property) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiClient.post<ApiResponse>("/game-properties/mortgage", {
        game_id: game.id,
        user_id: me.user_id,
        property_id: gp.property_id,
      });
      if (res.data?.success) {
        toast.success(`Mortgaged ${prop.name} for $${Math.floor(prop.price / 2)}.`);
        await onRefetch();
      } else {
        toast.error(res.data?.message ?? "Failed to mortgage property");
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? "Failed to mortgage property");
    } finally {
      setBusy(false);
    }
  };

  const handleDeclareBankruptcy = async () => {
    if (declaringBankruptcy) return;
    setDeclaringBankruptcy(true);
    try {
      await onDeclareBankruptcy();
    } finally {
      setDeclaringBankruptcy(false);
    }
  };

  return (
    <div
      className={`fixed ${bottomClass} left-1/2 -translate-x-1/2 z-40 w-[min(96vw,480px)]`}
    >
      <div className="rounded-xl bg-slate-900/95 border border-rose-500/50 shadow-2xl p-4">
        <p className="text-rose-400 font-semibold text-sm text-center mb-3">
          You&apos;re in debt (${me.balance}). Raise funds or declare bankruptcy.
        </p>

        {canRaiseFunds && (
          <div className="space-y-2 max-h-52 overflow-y-auto mb-3">
            {sellable.map(({ gp, prop }) => {
              const houses = gp.development ?? 0;
              const sellValue = prop?.cost_of_house
                ? Math.floor(prop.cost_of_house / 2)
                : 0;
              const label = houses >= 5 ? "Hotel" : `${houses} house${houses !== 1 ? "s" : ""}`;
              return (
                <div
                  key={`sell-${gp.property_id}`}
                  className="flex items-center justify-between gap-2 bg-slate-800/70 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{prop?.name}</p>
                    <p className="text-slate-400 text-xs">{label}</p>
                  </div>
                  <button
                    onClick={() => handleSellHouse(gp)}
                    disabled={busy}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold transition"
                  >
                    Sell house +${sellValue}
                  </button>
                </div>
              );
            })}

            {mortgageable.map(({ gp, prop }) => {
              const mortgageValue = prop ? Math.floor(prop.price / 2) : 0;
              return (
                <div
                  key={`mortgage-${gp.property_id}`}
                  className="flex items-center justify-between gap-2 bg-slate-800/70 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-slate-200 text-sm font-medium truncate">{prop?.name}</p>
                    <p className="text-slate-400 text-xs">${prop?.price} property</p>
                  </div>
                  <button
                    onClick={() => prop && handleMortgage(gp, prop)}
                    disabled={busy}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-semibold transition"
                  >
                    Mortgage +${mortgageValue}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={handleDeclareBankruptcy}
          disabled={declaringBankruptcy || busy}
          className="w-full py-2.5 rounded-lg bg-rose-700 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold text-sm transition"
        >
          {declaringBankruptcy ? "Declaring bankruptcy…" : "Declare bankruptcy"}
        </button>
      </div>
    </div>
  );
}
