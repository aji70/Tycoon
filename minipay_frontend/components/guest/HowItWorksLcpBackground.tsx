/**
 * Server-safe LCP background — native <img> matches layout.tsx preload URL exactly
 * (Next/Image optimizer URLs do not match /howItWorksBg1.png preload).
 */
export default function HowItWorksLcpBackground({
  visible = true,
}: {
  visible?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/howItWorksBg1.png"
      alt=""
      width={2000}
      height={1500}
      fetchPriority="high"
      decoding="async"
      sizes="(max-width: 640px) 480px, (max-width: 1024px) 768px, 100vw"
      className={`absolute inset-0 h-full w-full object-cover object-center ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden
    />
  );
}
