/**
 * Offline-safe font tokens.
 * We intentionally avoid next/font/google here because it fetches during build
 * and can fail in restricted/slow networks.
 */
function systemFontFallback(variable: string, className = "font-sans") {
  return { variable: `${variable} font-system-fallback`, className };
}

export const dmSans = systemFontFallback("--font-dm-sans");
export const kronaOne = systemFontFallback("--font-krona-one", "font-sans");
export const orbitron = systemFontFallback("--font-orbitron-sans", "font-sans");
