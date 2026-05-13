"use client";
export function ScanlineOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 hidden md:block">
      {/* Desktop only: Animated scanlines */}
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            rgba(0, 240, 255, 0.03) 0px,
            rgba(0, 240, 255, 0.03) 1px,
            transparent 1px,
            transparent 2px
          )`,
          animation: "scanlines 8s linear infinite",
          willChange: "transform",
        }}
      />
      {/* Grid overlay - static */}
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(0deg, transparent 24%, rgba(0, 240, 255, 0.05) 25%, rgba(0, 240, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.05) 75%, rgba(0, 240, 255, 0.05) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(0, 240, 255, 0.05) 25%, rgba(0, 240, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.05) 75%, rgba(0, 240, 255, 0.05) 76%, transparent 77%, transparent)
          `,
          backgroundSize: "50px 50px",
        }}
      />
      {/* Mobile: static grid only */}
      <div
        className="md:hidden w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(0deg, transparent 24%, rgba(0, 240, 255, 0.03) 25%, rgba(0, 240, 255, 0.03) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.03) 75%, rgba(0, 240, 255, 0.03) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(0, 240, 255, 0.03) 25%, rgba(0, 240, 255, 0.03) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.03) 75%, rgba(0, 240, 255, 0.03) 76%, transparent 77%, transparent)
          `,
          backgroundSize: "50px 50px",
        }}
      />
      <style>{`
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(10px); }
        }
      `}</style>
    </div>
  );
}
