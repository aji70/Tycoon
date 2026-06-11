'use client';

import React, { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import { slidesData } from '@/utils/slidesData';

let swiperStylesLoaded = false;

function loadSwiperStyles() {
  if (swiperStylesLoaded || typeof window === 'undefined') return;
  swiperStylesLoaded = true;
  void import('swiper/css');
  void import('swiper/css/pagination');
}

type HowItWorksCarouselProps = {
  currentSlide: number;
  onSlideChange: (index: number) => void;
};

export default function HowItWorksCarousel({
  currentSlide,
  onSlideChange,
}: HowItWorksCarouselProps) {
  const [swiperInstance, setSwiperInstance] = useState<
    { slideTo: (i: number) => void } | null
  >(null);

  useEffect(() => {
    loadSwiperStyles();
  }, []);

  return (
    <>
      <Swiper
        spaceBetween={30}
        slidesPerView={'auto'}
        centeredSlides={true}
        onSlideChange={(swiper) => onSlideChange(swiper.realIndex)}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        onSwiper={setSwiperInstance}
        className="w-full max-w-[644px] h-[350px] mt-10 px-6 [&_.swiper-slide]:will-change-transform"
        modules={[Pagination, Autoplay]}
        pagination={{ clickable: true, el: '.swiper-pagination' }}
      >
        {slidesData.map((item, index) => (
          <SwiperSlide
            key={index}
            className={`keen-slider__slide w-[90%] sm:w-full h-[350px] relative md:p-6 p-3 rounded-[12px] overflow-hidden flex items-center justify-center transition-[opacity,filter,transform] duration-500 will-change-transform ${
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
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onSlideChange(i);
                swiperInstance?.slideTo(i);
              }}
              aria-label={`Go to slide ${i + 1}`}
              className="flex h-3 w-9 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0"
            >
              <span
                className={`block h-3 w-3 origin-center rounded-full transition-[transform,background-color] duration-300 ease-out will-change-transform ${
                  currentSlide === i
                    ? 'scale-x-[3] bg-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.45)]'
                    : 'scale-x-100 bg-[#455A64]'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
