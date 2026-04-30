"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referralCapture";

/** Stores `?ref=` from the URL in sessionStorage for Privy → POST /auth/privy-signin. */
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
