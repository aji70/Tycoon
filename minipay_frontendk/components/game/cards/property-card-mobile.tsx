import React from "react";
import { Property } from "@/types/game";
import VacantLotName from "./VacantLotName";

type Position = "bottom" | "left" | "top" | "right";

interface PropertyCardMobileProps {
  square: Property & { position: Position };
  owner: string | null;
}

/** Bottom-row deed layout — reference style for every property side on mobile. */
const BOTTOM_ROW_CLASS = "border-t-8";

const PropertyCardMobile = ({ square, owner }: PropertyCardMobileProps) => {
  const { name, color } = square;
  const isOwned = !!owner;

  const smallTextStyle = { fontSize: "clamp(4px, 1.1vw, 6px)", textSizeAdjust: "none" as const };

  if (!isOwned) {
    return (
      <div
        className={`relative w-full h-full rounded-[2px] bg-[#c9b896]/75 box-border border border-[#1a1510]/35 shadow-[inset_0_0_0_1px_rgba(26,21,16,0.4)] ${BOTTOM_ROW_CLASS}`}
        style={{ borderColor: color, textSizeAdjust: "none" }}
        aria-label={name}
      >
        <VacantLotName name={name} />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full bg-[#F0F7F7] text-[#0B191A] p-1 flex flex-col justify-between rounded-[2.5px] ${BOTTOM_ROW_CLASS}`}
      style={{ borderColor: color, textSizeAdjust: "none" }}
    >
      <div className="flex flex-col items-center pt-1.5">
        <p className="font-bold uppercase text-center max-w-full truncate" style={{ ...smallTextStyle, fontSize: "clamp(4px, 1.2vw, 6px)" }}>
          {name}
        </p>
      </div>

      <p className="absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] bottom-0.5 right-0.5 text-amber-600" style={smallTextStyle}>
        {owner}
      </p>
    </div>
  );
};

export default PropertyCardMobile;
