"use client";

type BarPoint = {
  label: string;
  value: number;
  title?: string;
};

export default function AdminBarChart({
  series,
  valueLabel = "users",
  barClassName = "bg-cyan-600/75",
}: {
  series: BarPoint[];
  valueLabel?: string;
  barClassName?: string;
}) {
  if (!series.length) {
    return <p className="text-sm text-slate-600 mt-2">No data for this range.</p>;
  }

  const max = Math.max(1, ...series.map((d) => d.value));

  return (
    <div className="mt-4">
      <div className="flex items-end gap-1 h-40 px-1 overflow-x-auto">
        {series.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="flex flex-col items-center gap-1 min-w-[28px] flex-1 max-w-[48px]"
              title={d.title ?? `${d.label}: ${d.value.toLocaleString()} ${valueLabel}`}
            >
              <span className="text-[10px] text-slate-500 tabular-nums">{d.value > 0 ? d.value : ""}</span>
              <div className="w-full h-28 flex items-end justify-center">
                <div
                  className={`w-full max-w-[20px] rounded-t min-h-[2px] transition-all ${barClassName}`}
                  style={{ height: `${Math.max(2, pct)}%` }}
                />
              </div>
              <span className="text-[9px] text-slate-600 truncate w-full text-center leading-tight">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
