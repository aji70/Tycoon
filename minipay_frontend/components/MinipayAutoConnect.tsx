"use client";

import { useMinipayAutoConnect } from "@/hooks/useMinipayAutoConnect";

/** Invisible: connects MiniPay injected wallet on first load. */
export default function MinipayAutoConnect() {
  useMinipayAutoConnect();
  return null;
}
