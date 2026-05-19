import { JetBrains_Mono, Syne } from "next/font/google";

const useSystemFonts = process.env.NEXT_PUBLIC_USE_SYSTEM_FONTS === "true";

function systemFontFallback(variable: string, className = "font-sans") {
  return { variable: `${variable} font-system-fallback`, className };
}

const syneLoaded = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsLoaded = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const syne = useSystemFonts ? systemFontFallback("--font-syne") : syneLoaded;
export const jetbrainsMono = useSystemFonts
  ? systemFontFallback("--font-jetbrains-mono", "font-mono")
  : jetbrainsLoaded;
