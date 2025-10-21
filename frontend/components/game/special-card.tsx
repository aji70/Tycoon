import React from "react";
import Image from "next/image";
import { GrHelp } from "react-icons/gr";
import { GiChest } from "react-icons/gi"; // Fallback icon for Community Chest if image fails

type Position = "bottom" | "left" | "top" | "right";

interface SpecialCardProps {
  square: {
    id: number;
    name: string;
    position: Position;
    type?: string;
    [key: string]: any;
  };
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
  const isIncomeTax = name === "Income Tax";
  const isLuxuryTax = name === "Luxury Tax";
  const isTax = isIncomeTax || isLuxuryTax;

  const taxAmount = isIncomeTax ? "$200" : isLuxuryTax ? "$100" : "";
  const taxName = isIncomeTax ? "Income Tax" : isLuxuryTax ? "Luxury Tax" : name;

  const bgClass = isTax
    ? "bg-amber-50"
    : isCommunityChest
    ? "bg-white"
    : "bg-[#0B191A]";

  const textClass = isTax || isCommunityChest ? "text-black" : "text-[#55656D]";
  const iconClass = isTax || isCommunityChest ? "text-gray-800" : "text-[#0FF0FC]";

  // Shared classes for absolutes (no position variance needed)
  const sharedAbsoluteClass = "absolute left-0 right-0 text-center";
  const nameTextClass = `text-[3px] md:text-[4px] uppercase font-bold ${sharedAbsoluteClass} top-[20%] truncate`;
  const dollarClass = `text-2xl font-black ${sharedAbsoluteClass} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`;
  const payTextClass = `text-[3px] md:text-[4px] font-bold px-1 truncate leading-tight ${sharedAbsoluteClass} bottom-[20%]`;

  const outerClasses = `relative w-full h-full ${bgClass} ${isCommunityChest ? '' : 'p-0.5'} rounded-[2.5px] ${orientationClasses[position]} shadow-sm overflow-hidden`;

  const contentClass = `text-[3.5px] md:text-[4.5px] uppercase font-semibold tracking-wide ${textClass}`;

  return (
    <div className={outerClasses}>
      {isChance ? (
        <>
          <GrHelp className={`${iconClass} size-5 md:size-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2`} />
          <p className={`${contentClass} absolute bottom-0.5 left-0.5 right-0.5`}>Chance</p>
        </>
      ) : isCommunityChest ? (
        <>
          <Image
            src="/game/communitychest.jpeg"
            alt="Community Chest"
            fill
            className="object-contain"
            priority // Optional: if frequently viewed
            onError={(e) => { // Fallback to icon if image fails
              (e.target as HTMLImageElement).style.display = 'none';
              // You'd need to conditionally render GiChest here if desired
            }}
          />
          <p className={`${contentClass} top-0 bg-white py-0.5`}>Community Chest</p>
        </>
      ) : isTax ? (
        <>
          <p className={`${nameTextClass} text-black`}>{taxName}</p>
          <div className={`${dollarClass} text-black`}>$</div>
          <p className={`${payTextClass} text-black`}>{taxAmount}</p>
        </>
      ) : (
        <p className={`${contentClass} ${sharedAbsoluteClass} top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 truncate`}>
          {name}
        </p>
      )}
    </div>
  );
};

export default SpecialCard;