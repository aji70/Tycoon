/** Hostnames that should only be used inside the MiniPay app (e.g. tycoon.world.xyz). */
export const MINIPAY_ONLY_HOSTS = (
  process.env.NEXT_PUBLIC_MINIPAY_ONLY_HOSTS || "tycoon.world.xyz,www.tycoon.world.xyz"
)
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

/** Main Tycoon site for desktop / non-MiniPay browsers. */
export const MAIN_TYCOON_SITE_URL = (
  process.env.NEXT_PUBLIC_MAIN_SITE_URL || "https://www.playtycoon.xyz"
).replace(/\/$/, "");

/** Inline script: redirect non-MiniPay visitors off MiniPay-only hosts before React hydrates. */
export function buildMinipaySiteRedirectScript(): string {
  const hostsJson = JSON.stringify(MINIPAY_ONLY_HOSTS);
  const mainSite = MAIN_TYCOON_SITE_URL.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `
(function(){
  var hosts=${hostsJson};
  var mainSite='${mainSite}';
  var h=(location.hostname||'').toLowerCase();
  if(hosts.indexOf(h)===-1)return;
  if(h==='localhost'||h==='127.0.0.1')return;
  if(/[?&]stay=1(?:&|$)/.test(location.search))return;
  function isMiniPay(){
    return!!(window.ethereum&&window.ethereum.isMiniPay);
  }
  function redirect(){
    location.replace(mainSite+location.pathname+location.search+location.hash);
  }
  if(isMiniPay())return;
  var polls=0;
  var timer=setInterval(function(){
    polls++;
    if(isMiniPay()){clearInterval(timer);return;}
    if(polls>=24){clearInterval(timer);if(!isMiniPay())redirect();}
  },50);
})();
`.trim();
}

export function isMinipayOnlyHost(hostname: string): boolean {
  return MINIPAY_ONLY_HOSTS.includes(hostname.trim().toLowerCase());
}
