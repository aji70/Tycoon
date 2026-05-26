'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import { slidesData } from '@/utils/slidesData';

const HOW_IT_WORKS_BACKGROUNDS = [
  '/howItWorksBg1.png',
  '/howItWorksBg2.png',
  '/howItWorksBg3.png',
  '/howItWorksBg4.png',
] as const;

const SLIDE_COUNT = HOW_IT_WORKS_BACKGROUNDS.length;

const HowItWorks = () => {
  useEffect(() => {
    void import('swiper/css');
    void import('swiper/css/pagination');
    void import('@/styles/how-it-works-swiper.css');
  }, []);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [swiperInstance, setSwiperInstance] = useState<
    { slideTo: (i: number) => void } | null
  >(null);

  const backgroundIndices = useMemo(() => {
    const next = (currentSlide + 1) % SLIDE_COUNT;
    return [currentSlide, next] as const;
  }, [currentSlide]);

  return (
    <section className="relative w-full h-[856px] overflow-hidden flex flex-col items-center justify-center border-y-[1px] border-[#0FF0FC]/20">
      <div className="absolute inset-0 z-0">
        {backgroundIndices.map((idx) => (
          <Image
            key={idx}
            src={HOW_IT_WORKS_BACKGROUNDS[idx]}
            alt=""
            fill
            className={`object-cover object-center transition-opacity duration-700 ease-in-out ${
              idx === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="100vw"
            quality={75}
            loading={idx === currentSlide ? 'eager' : 'lazy'}
            aria-hidden
          />
        ))}
      </div>

      {/* Foreground content */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#010F1000] via-[#010F10] z-[1] w-full px-4 flex flex-col items-center justify-center">
        <div className="w-full flex flex-col justify-center items-center gap-2 mb-6">
          <span className="game-badge mb-2">TUTORIAL</span>
          <h1 className="game-section-title text-center md:text-[48px] text-[32px] leading-normal">How it works</h1>
          <p className="md:max-w-[60%] w-full text-center text-[18px] md:text-[20px] font-[400] font-dmSans leading-[30px] text-[#E0F7F8]">
            Complete each step to master Tycoon. Simple flow, zero stress.
          </p>
        </div>

        <Swiper
          spaceBetween={30}
          slidesPerView={'auto'}
          centeredSlides={true}
          onSlideChange={(swiper) => setCurrentSlide(swiper.realIndex)}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          onSwiper={setSwiperInstance}
          className="tycoon-how-swiper w-full max-w-[644px] h-[350px] mt-10 px-6"
          modules={[Pagination, Autoplay]}
          pagination={{ clickable: true, el: '.swiper-pagination' }}
        >
          {slidesData.map((item, index) => (
            <SwiperSlide
              key={index}
              className={`keen-slider__slide w-[90%] sm:w-full h-[350px] relative md:p-6 p-3 rounded-[12px] overflow-hidden flex items-center justify-center transition-all duration-500 ${
                currentSlide !== index ? 'blur-[1.5px] opacity-40 scale-[0.95]' : 'opacity-100 blur-0 scale-100'
              }`}
            >
              <div className="w-full h-full bg-[#091F201F] border-[1px] border-[#003B3E] rounded-[12px] custom-glow-blur p-6 md:p-10 flex flex-col justify-between items-center game-panel">
                <div className="w-full flex items-center justify-between">
                  {item.icon}
                  <span className="game-level-label">LEVEL {index + 1}</span>
                </div>
                <div className="flex flex-col">
                  <h2 className="md:text-[25px] text-[20px] text-[#FFFFFF] font-[800] font-orbitron uppercase">{item.title}</h2>
                  <p className="md:text-[18px] text-[17px] leading-[28px] text-[#BDBDBD] font-[400] font-dmSans mt-2">{item.description}</p>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <div className="w-full max-w-[620px] flex justify-between items-center gap-6 mt-6 md:px-6">
          <div className="swiper-pagination hidden" />
          <div
            className="tycoon-swiper-dots"
            style={{ width: `${4 * 12 + 3 * 8}px` }}
          >
            <span
              className="tycoon-swiper-dot-indicator"
              style={{ transform: `translateX(${currentSlide * 20}px)` }}
              aria-hidden
            />
            {[0, 1, 2, 3].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setCurrentSlide(i);
                  swiperInstance?.slideTo(i);
                }}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={currentSlide === i ? 'true' : undefined}
                className="tycoon-swiper-dot relative z-[1]"
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
