"use client";

import { squareNameTextStyle } from "@/lib/vacantPropertyName";

type VacantLotNameProps = {
  name: string;
  /** 3D flat deeds: horizontal text under color stripe, same as bottom-row tiles. */
  layout?: "default" | "flat-deed";
};

/** Property name on vacant squares — text badge only; does not affect square size. */
export default function VacantLotName({ name, layout = "default" }: VacantLotNameProps) {
  const label = name.trim();

  if (layout === "flat-deed") {
    return (
      <div
        className="absolute inset-0 flex flex-col pointer-events-none overflow-hidden"
        aria-hidden
      >
        {/* Spacer for border-t-8 color stripe */}
        <div className="h-2 shrink-0" />
        <div className="flex-1 flex items-center justify-center px-0.5 pb-0.5 min-h-0">
          <span
            className="uppercase text-white text-center max-w-full w-full"
            style={{
              ...squareNameTextStyle,
              textSizeAdjust: "none",
              writingMode: "horizontal-tb",
            }}
          >
            {label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none"
      aria-hidden
    >
      <span
        className="uppercase text-white text-center max-w-[92%]"
        style={{ ...squareNameTextStyle, textSizeAdjust: "none" }}
      >
        {label}
      </span>
    </div>
  );
}
