import React from 'react';
import Image from 'next/image';
import { BoardSquare } from "@/types/game";

interface PropertyCardProps {
    square: BoardSquare;
}

const PropertyCard = ({ square }: PropertyCardProps) => {
    const { name, price, rent_site_only, color, position, icon } = square;

    // Define classes for different orientations
    const orientationClasses = {
        bottom: 'border-t-8',
        left: 'border-t-8 rotate-90',
        top: 'border-b-8',
        right: 'border-t-8 -rotate-90',
    };

    const priceOrientationClasses = {
        bottom: 'bottom-0.5 right-0.5',
        left: 'bottom-[30%] -right-0.5 transform -rotate-90',
        top: 'bottom-0.5 right-0.5',
        right: 'transform rotate-90 bottom-[30%] -left-0.5',
    };

    const rent_site_onlyOrientationClasses = {
        bottom: 'bottom-0.5 left-0.5', // Confirmed working
        left: 'bottom-[30%] left-0.5 transform -rotate-90', // Confirmed working
        top: 'bottom-0.5 left-0.5', // Moved to bottom-left for top orientation
        right: 'transform rotate-90 bottom-[30%] right-0.5', // Confirmed working
    };

    const imageOrientationClasses = {
        bottom: '',
        left: '-rotate-90',
        top: '',
        right: 'rotate-90',
    };

    return (
        <div
            className={`relative w-full h-full bg-[#F0F7F7] text-[#0B191A] p-1 flex flex-col justify-between rounded-[2.5px] ${orientationClasses[position]}`}
            style={{ borderColor: color }}
        >
            <div className={`flex flex-col items-center pt-1.5`}> {/* Kept pt-1.5 to prevent overlap */}
                <p className="text-[5px] md:text-[5px] font-bold uppercase text-center max-w-full truncate">{name}</p>
                {icon && (
                    <Image
                        src={icon}
                        alt={name}
                        width={25}
                        height={25}
                        className={`my-1 transform ${imageOrientationClasses[position]}`}
                    />
                )}
            </div>
            <p
                className={`text-[5px] md:text-[6px] absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] ${priceOrientationClasses[position]}`}
            >
                ${price}
            </p>
            {rent_site_only && (
                <p
                    className={`text-[5px] md:text-[6px] absolute font-semibold bg-[#F0F7F7] shadow-sm p-0.5 rounded-[3px] ${rent_site_onlyOrientationClasses[position]}`}
                >
                    ${rent_site_only}
                </p>
            )}
        </div>
    );
};

export default PropertyCard;