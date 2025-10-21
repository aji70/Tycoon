import React from 'react';
import Image from 'next/image';

interface BoardSquare {
  id: number;
  name: string;
  type: 'property' | 'special' | 'corner';
  gridPosition: {
    row: number;
    col: number;
  };
  icon?: string;
  // Add other properties as needed based on usage
}

interface CornerCardProps {
  square: BoardSquare;
}

const CornerCard = ({ square }: CornerCardProps) => {
  return (
    <div className="w-full h-full bg-[#F0F7F7] flex flex-col justify-center items-center text-[#0B191A] rounded-[2.5px] p-0.5">
      {square.icon && (
        <Image
          src={square.icon}
          alt={square.name}
          width={48}
          height={48}
          className="w-full h-full"
        />
      )}
    </div>
  );
};

export default CornerCard;