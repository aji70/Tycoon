"use client";

import { requestWeb3Mount } from "@/context/Web3ReadyContext";

export default function MountWeb3Button() {
  return (
    <button
      type="button"
      onClick={() => requestWeb3Mount()}
      className="rounded-xl bg-[#003B3E] px-6 py-3 font-orbitron text-sm font-semibold text-[#17ffff] transition hover:bg-[#004d52]"
    >
      Connect wallet
    </button>
  );
}
