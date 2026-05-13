"use client";
export function ScanlineOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 w-full h-full">
      {/* Mobile + Desktop: animated scanlines + grid */}
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `
            linear-gradient(0deg, transparent 24%, rgba(0, 240, 255, 0.06) 25%, rgba(0, 240, 255, 0.06) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.06) 75%, rgba(0, 240, 255, 0.06) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(0, 240, 255, 0.06) 25%, rgba(0, 240, 255, 0.06) 26%, transparent 27%, transparent 74%, rgba(0, 240, 255, 0.06) 75%, rgba(0, 240, 255, 0.06) 76%, transparent 77%, transparent)
          `,
          backgroundSize: "40px 40px",
          animation: "scanlines 8s linear infinite",
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
