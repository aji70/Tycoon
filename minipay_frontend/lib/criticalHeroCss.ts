/** Inline above-the-fold hero/LCP styles — paints before the main Tailwind chunk loads. */
export const CRITICAL_HERO_CSS = `
:root{--font-krona-one:var(--font-krona-one)}
body{background:#010F10;color:#F0F7F7;margin:0}
.font-kronaOne{font-family:var(--font-krona-one),ui-sans-serif,system-ui,sans-serif}
.neon-title-hero{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision}
.neon-title-text{position:relative;z-index:1;display:block;color:#00F0FF;filter:drop-shadow(0 0 8px rgba(0,240,255,.8)) drop-shadow(0 0 16px rgba(0,240,255,.6))}
.neon-title-glow-pulse{position:absolute;inset:0;display:block;color:inherit;pointer-events:none;user-select:none;filter:drop-shadow(0 0 10px rgba(0,240,255,.9)) drop-shadow(0 0 20px rgba(15,240,252,.75));opacity:.55}
`.trim();
