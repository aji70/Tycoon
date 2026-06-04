"use client";

import { useLayoutEffect, useRef } from "react";
import { vacantPropertyNameLines } from "@/lib/vacantPropertyName";

/** Auto-sized stacked words for vacant property squares (fits parent box). */
export default function VacantLotName({ name }: { name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const lines = vacantPropertyNameLines(name);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w < 2 || h < 2) return;

      const longest = Math.max(...lines.map((line) => line.length), 1);
      let size = Math.min(w / (longest * 0.58), h / (lines.length * 1.35), 11);
      size = Math.max(3, size);
      text.style.fontSize = `${size}px`;

      while (
        size > 3 &&
        (text.scrollHeight > h - 1 || text.scrollWidth > w - 1)
      ) {
        size -= 0.25;
        text.style.fontSize = `${size}px`;
      }
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    return () => ro.disconnect();
  }, [name, lines.join("\n")]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-0.5 py-0.5"
      aria-hidden
    >
      <div
        ref={textRef}
        className="flex flex-col items-center justify-center gap-0 uppercase font-semibold text-[#2d2618] leading-[1.05] max-w-full max-h-full"
        style={{ textSizeAdjust: "none" }}
      >
        {lines.map((word, i) => (
          <span key={`${word}-${i}`} className="block text-center whitespace-nowrap">
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}
