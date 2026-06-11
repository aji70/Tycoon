'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import HowItWorksLcpBackground from '@/components/guest/HowItWorksLcpBackground';

const HowItWorksCarousel = dynamic(
  () => import('@/components/guest/HowItWorksCarousel'),
  {
    ssr: false,
    loading: () => <div className="h-[350px] w-full max-w-[644px] mt-10" aria-hidden />,
  }
);

const HOW_IT_WORKS_BACKGROUNDS = [
  '/howItWorksBg1.png',
  '/howItWorksBg2.png',
  '/howItWorksBg3.png',
  '/howItWorksBg4.png',
] as const;

const SLIDE_COUNT = HOW_IT_WORKS_BACKGROUNDS.length;

/** Responsive srcset — avoids shipping 900px+ backgrounds to narrow viewports. */
const HOW_IT_WORKS_IMAGE_SIZES =
  '(max-width: 640px) 480px, (max-width: 1024px) 768px, 100vw';

const HowItWorks = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const backgroundIndices = useMemo(() => {
    const next = (currentSlide + 1) % SLIDE_COUNT;
    return [currentSlide, next] as const;
  }, [currentSlide]);

  return (
    <section className="relative w-full h-[856px] overflow-hidden flex flex-col items-center justify-center border-y-[1px] border-[#0FF0FC]/20">
      <div className="absolute inset-0 z-0">
        {backgroundIndices.map((idx) => {
          const isActive = idx === currentSlide;
          const isLcpAsset = idx === 0;

          if (isLcpAsset) {
            return (
              <HowItWorksLcpBackground key={idx} visible={isActive} />
            );
          }

          return (
            <Image
              key={idx}
              src={HOW_IT_WORKS_BACKGROUNDS[idx]}
              alt=""
              fill
              className={
                isActive
                  ? 'object-cover object-center opacity-100'
                  : 'object-cover object-center opacity-0'
              }
              sizes={HOW_IT_WORKS_IMAGE_SIZES}
              quality={75}
              loading={isActive ? 'eager' : 'lazy'}
              aria-hidden
            />
          );
        })}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-[#010F1000] via-[#010F10] z-[1] w-full px-4 flex flex-col items-center justify-center">
        <div className="w-full flex flex-col justify-center items-center gap-2 mb-6">
          <span className="game-badge mb-2">TUTORIAL</span>
          <h1 className="game-section-title text-center md:text-[48px] text-[32px] leading-normal">How it works</h1>
          <p className="md:max-w-[60%] w-full text-center text-[18px] md:text-[20px] font-[400] font-dmSans leading-[30px] text-[#E0F7F8]">
            Complete each step to master Tycoon. Simple flow, zero stress.
          </p>
        </div>

        <HowItWorksCarousel
          currentSlide={currentSlide}
          onSlideChange={setCurrentSlide}
        />
      </div>
    </section>
  );
};

export default HowItWorks;
