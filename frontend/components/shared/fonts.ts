/**
 * Google Fonts (DM Sans, Krona One, Orbitron).
 * If NEXT_PUBLIC_USE_SYSTEM_FONTS=true (e.g. offline/CI build), exports system-font fallbacks
 * so the build succeeds without fetching Google Fonts.
 */
const useSystemFonts = process.env.NEXT_PUBLIC_USE_SYSTEM_FONTS === "true";

function systemFontFallback(variable: string, className = "font-sans") {
  return {
    variable: `${variable} font-system-fallback`,
    className,
  };
}

let dmSans: { variable: string; className: string };
let kronaOne: { variable: string; className: string };
let orbitron: { variable: string; className: string };

if (useSystemFonts) {
  dmSans = systemFontFallback("--font-dm-sans");
  kronaOne = systemFontFallback("--font-krona-one", "font-sans");
  orbitron = systemFontFallback("--font-orbitron-sans", "font-sans");
} else {
  const { DM_Sans, Orbitron, Krona_One } = require("next/font/google");
  dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
  });
  kronaOne = Krona_One({
    variable: "--font-krona-one",
    subsets: ["latin"],
    weight: ["400"],
    display: "swap",
  });
  orbitron = Orbitron({
    variable: "--font-orbitron-sans",
    weight: ["400", "500", "700"],
    subsets: ["latin"],
    display: "swap",
  });
}

export { dmSans, kronaOne, orbitron };
