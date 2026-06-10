import dynamic from 'next/dynamic';

const Leaderboard = dynamic(() => import('@/components/leaderboard/leaderboard'), {
  ssr: false,
  loading: () => (
    <main className="w-full min-h-screen flex items-center justify-center bg-[#020a0b]">
      <p className="text-cyan-300/80 text-sm animate-pulse">Loading leaderboard…</p>
    </main>
  ),
});

export default function LeaderboardPage() {
  return (
    <main className="w-full min-h-screen">
      <Leaderboard />
    </main>
  );
}
