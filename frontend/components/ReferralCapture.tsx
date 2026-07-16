"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/referralCapture";

/** Stores `?ref=` from the URL in sessionStorage for Web3Auth → POST /auth/web3auth-signin. */
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralFromUrl();
  }, []);
  return null;
}
