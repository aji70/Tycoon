import React from "react";
import Image from "next/image";
import { Property } from "@/types/game";
import { GrHelp } from "react-icons/gr";

type Position = "bottom" | "left" | "top" | "right";

interface SpecialCardProps {
  square: Property & { position: Position };
}

const SpecialCard = ({ square }: SpecialCardProps) => {
  const { position, name } = square;

  const orientationClasses: Record<Position, string> = {
    bottom: "",
    left: "rotate-90",
    top: "",
    right: "-rotate-90",
  };

  const isChance = name === "Chance";
  const isCommunityChest = name === "Community Chest";
  const isTaxFromBackend = name === "Luxury Tax"; // Assuming backend sends "Luxury Tax" for both
  const isIncomeTax = position === "bottom" && isTaxFromBackend;
  const isLuxuryTax = position === "right" && isTaxFromBackend;
  const isTax = isIncomeTax || isLuxuryTax;

  const taxAmount = isIncomeTax ? '$200' : isLuxuryTax ? '$100' : 0;
  const taxName = isIncomeTax ? "Income Tax" : isLuxuryTax ? "Luxury Tax" : name;
  const payText = `${taxAmount}`;

  const bgClass = isIncomeTax
    ? "bg-amber-50"
    : isLuxuryTax
    ? "bg-amber-50"
    : isCommunityChest
    ? "bg-white"
    : "bg-[#0B191A]";

  // Force black text for taxes and community chest
  const textClass = isTax || isCommunityChest ? "text-black" : "text-[#55656D]";
  const iconClass = isTax || isCommunityChest ? "text-gray-800" : "text-[#0FF0FC]";

  // Name text position (now above $ for tax)
  const nameOrientationClasses: Record<Position, string> = {
    bottom: "top-[20%] left-0 right-0 text-center",
    left: "top-[20%] left-0 right-0 text-center",
    top: "top-[20%] left-0 right-0 text-center",
    right: "top-[20%] left-0 right-0 text-center",
  };

  // Dollar sign - centered
  const dollarOrientationClasses: Record<Position, string> = {
    bottom: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
    left: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
    top: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
    right: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
  };

  // Pay text position (below $)
  const payTextOrientationClasses: Record<Position, string> = {
    bottom: "bottom-[20%] left-0 right-0 text-center",
    left: "bottom-[20%] left-0 right-0 text-center",
    top: "bottom-[20%] left-0 right-0 text-center",
    right: "bottom-[20%] left-0 right-0 text-center",
  };

  const outerClasses = `relative w-full h-full ${bgClass} ${isCommunityChest ? '' : 'p-0.5'} rounded-[2.5px] ${orientationClasses[position]} shadow-sm ${textClass} ${isCommunityChest ? 'overflow-hidden' : ''}`;

  return (
    <div className={outerClasses}>
      {isChance ? (
        <>
          <GrHelp className={`${iconClass} size-5 md:size-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />
          <p className="absolute bottom-0.5 left-0.5 right-0.5 text-center text-[3.5px] md:text-[4.5px] uppercase font-semibold tracking-wide">
            Chance
          </p>
        </>
      ) : isCommunityChest ? (
        <>
          <Image
            src="/game/communitychest.jpeg"
            alt="Community Chest"
            fill
            className="object-contain"
          />
          <p className="absolute top-0 left-0 right-0 text-center text-[3.5px] md:text-[4.5px] uppercase font-bold bg-white py-0.5">
            Community Chest
          </p>
         
        </>
      ) : isTax ? (
        <div className="relative w-full h-full">
          {/* TAX NAME ON TOP (Black text) */}
          <p className={`absolute text-[3px] md:text-[4px] uppercase font-bold ${nameOrientationClasses[position]}`}>
            {taxName}
          </p>

          {/* DOLLAR SIGN (CENTER) */}
          <div className={`absolute text-2xl font-black ${dollarOrientationClasses[position]}`}>
            $
          </div>

          {/* PAY TEXT BELOW */}
          <p className={`absolute text-[3px] md:text-[4px] font-bold text-center px-1 truncate leading-tight text-black ${payTextOrientationClasses[position]}`}>
            {payText}
          </p>
        </div>
      ) : (
        <p className="text-[4px] md:text-[5px] uppercase font-semibold text-center px-1">
          {name}
        </p>
      )}
    </div>
  );
};

export default SpecialCard;