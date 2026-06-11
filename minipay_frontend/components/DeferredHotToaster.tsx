"use client";

import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("react-hot-toast").then((m) => m.Toaster),
  { ssr: false }
);

/** react-hot-toast UI — after hydration (board/game paths). */
export default function DeferredHotToaster() {
  return <Toaster position="top-center" />;
}
