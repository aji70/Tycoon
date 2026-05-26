interface NeonTitleProps {
  text: string;
  size?: "sm" | "md" | "lg";
}

export function NeonTitle({ text, size = "lg" }: NeonTitleProps) {
  const sizeClasses = {
    sm: "text-4xl md:text-5xl",
    md: "text-6xl md:text-7xl",
    lg: "text-7xl md:text-8xl lg:text-9xl",
  };

  return (
    <h1
      className={`neon-title-hero ${sizeClasses[size]} font-kronaOne font-bold uppercase tracking-tighter text-[#00F0FF] relative z-10`}
    >
      <span className="neon-title-text">{text}</span>
      <span className="neon-title-glow-pulse" aria-hidden="true">
        {text}
      </span>
    </h1>
  );
}
