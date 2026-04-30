import { Suspense } from "react";

function Board3DMobileLoading() {
  return (
    <div
      className="fixed inset-0 w-full flex items-center justify-center bg-[#010F10]"
      style={{ height: "100dvh" }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/50 border-t-cyan-400 animate-spin" />
        <p className="text-sm text-slate-400">Loading board…</p>
      </div>
    </div>
  );
}

export default function Board3DMobileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<Board3DMobileLoading />}>{children}</Suspense>;
}
