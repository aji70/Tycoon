"use client";
import React from "react";
import {
  AgentSettings,
  TradeBehavior,
  BuildStyle,
  BuyStyle,
} from "@/hooks/useAgentSettings";

interface AgentSettingsPanelProps {
  settings: AgentSettings;
  onChange: (updates: Partial<AgentSettings>) => void;
}

function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; desc: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
        {label}
      </p>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            title={opt.desc}
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-[10px] px-1.5 py-1 rounded border transition-colors leading-tight text-center ${
              value === opt.value
                ? "bg-cyan-600 border-cyan-500 text-white font-semibold"
                : "bg-slate-700/60 border-slate-600 text-slate-300 hover:bg-slate-600/60"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const TRADE_OPTIONS: { value: TradeBehavior; label: string; desc: string }[] = [
  {
    value: "never_sell",
    label: "Never sell",
    desc: "Always decline trades that ask for your properties",
  },
  {
    value: "smart",
    label: "Smart",
    desc: "Decline if it would complete an opponent's monopoly; otherwise evaluate the price",
  },
  {
    value: "generous",
    label: "Generous",
    desc: "Accept any offer with a 10 %+ premium over property value",
  },
];

const BUILD_OPTIONS: { value: BuildStyle; label: string; desc: string }[] = [
  {
    value: "conservative",
    label: "Conservative",
    desc: "Only build when cash > $800; keeps a $600 reserve after building",
  },
  {
    value: "balanced",
    label: "Balanced",
    desc: "Builds when cash > $300; keeps $150 after",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    desc: "Builds as soon as cash > $150; spends down to $0",
  },
];

const BUY_OPTIONS: { value: BuyStyle; label: string; desc: string }[] = [
  {
    value: "conservative",
    label: "Conservative",
    desc: "Only buys high-value / near-monopoly properties; keeps $600 reserve",
  },
  {
    value: "balanced",
    label: "Balanced",
    desc: "Buys strategically good properties; keeps $400 reserve",
  },
  {
    value: "aggressive",
    label: "Aggressive",
    desc: "Buys almost everything affordable; keeps only $200 reserve",
  },
];

export function AgentSettingsPanel({ settings, onChange }: AgentSettingsPanelProps) {
  return (
    <div className="rounded-lg border border-slate-600/80 bg-slate-900/95 shadow-xl p-3 space-y-3 w-64">
      <p className="text-xs font-bold text-slate-200">Agent behaviour</p>

      <OptionRow<TradeBehavior>
        label="Trading (incoming offers)"
        value={settings.tradeBehavior}
        options={TRADE_OPTIONS}
        onChange={(v) => onChange({ tradeBehavior: v })}
      />

      <OptionRow<BuildStyle>
        label="Building"
        value={settings.buildStyle}
        options={BUILD_OPTIONS}
        onChange={(v) => onChange({ buildStyle: v })}
      />

      <OptionRow<BuyStyle>
        label="Buying"
        value={settings.buyStyle}
        options={BUY_OPTIONS}
        onChange={(v) => onChange({ buyStyle: v })}
      />
    </div>
  );
}
