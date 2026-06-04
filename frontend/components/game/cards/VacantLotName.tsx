"use client";

import { squareNameTextStyle } from "@/lib/vacantPropertyName";

/** Property name on vacant squares — text badge only; does not affect square size. */
export default function VacantLotName({ name }: { name: string }) {
  const label = name.trim();

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
