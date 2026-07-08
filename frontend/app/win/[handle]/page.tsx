import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = (
  process.env.NEXT_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.tycoonworld.xyz"
)
  .trim()
  .replace(/\/$/, "");

/** Decode + sanitize a username taken from the URL so it's safe to render and put in tags. */
function cleanHandle(raw: string): string {
  let h = "";
  try {
    h = decodeURIComponent(raw);
  } catch {
    h = raw;
  }
  h = h.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  if (h.length > 40) h = `${h.slice(0, 39)}…`;
  return h || "A Tycoon";
}

export function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Metadata {
  const handle = cleanHandle(params.handle);
  const title = `${handle} won on Tycoon 🏆`;
  const description = `${handle} ran the table on Tycoon — the on-chain Monopoly game on Celo. Think you can beat them? Jump into a game.`;
  const url = `${SITE_URL}/win/${encodeURIComponent(handle)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Tycoon",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function WinSharePage({
  params,
}: {
  params: { handle: string };
}) {
  const handle = cleanHandle(params.handle);

  return (
    <main className="min-h-[100dvh] w-full flex items-center justify-center px-4 py-12 bg-[#010F10]">
      <div className="relative w-full max-w-lg rounded-[2rem] overflow-hidden border-2 border-cyan-400/40 bg-gradient-to-b from-indigo-950/90 via-violet-950/60 to-slate-950/95 shadow-2xl shadow-cyan-900/30 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.18),transparent)]" />
        <div className="relative z-10 p-8 sm:p-10">
          <p className="text-[0.7rem] uppercase tracking-[0.35em] text-cyan-300/90 font-bold mb-4">
            Tycoon champion
          </p>

          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-2 border-cyan-400/50 bg-cyan-950/40 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
            <span className="text-5xl font-black text-cyan-300">★</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-200 to-cyan-300 mb-3">
            {handle} won 🏆
          </h1>
          <p className="text-slate-300 text-base sm:text-lg mb-8 leading-relaxed">
            {handle} ran the table on <span className="text-cyan-300 font-semibold">Tycoon</span> — the
            on-chain Monopoly game. Think you can last longer? Step up and prove it.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/join-room-3d"
              className="w-full py-4 px-6 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-lg shadow-lg shadow-cyan-900/40 border border-cyan-300/40 transition-all"
            >
              Play now — join a game
            </Link>
            <Link
              href="/"
              className="w-full py-3 px-6 rounded-2xl border border-white/15 bg-white/5 text-slate-100 font-semibold hover:bg-white/10 transition-colors"
            >
              What is Tycoon?
            </Link>
          </div>

          <p className="text-xs text-slate-500 mt-8">Roll the dice. Build your empire.</p>
        </div>
      </div>
    </main>
  );
}
