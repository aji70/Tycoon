"use client";

import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FocusEvent,
  type SetStateAction,
} from "react";

/** Digits-only draft for cash fields — avoids Android WebView `type="number"` breakage. */
export function sanitizeCashDigits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

export function cashDigitsToAmount(digits: string): number {
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function amountToCashDigits(amount: number): string {
  if (!amount || amount <= 0) return "";
  return String(Math.floor(amount));
}

/**
 * String draft synced to a numeric parent amount.
 * Keeps empty/`""` while typing (Android MiniPay WebViews break on controlled `type="number"`).
 */
export function useCashAmountDraft(
  amount: number,
  setAmount: Dispatch<SetStateAction<number>>,
  open: boolean
) {
  const [draft, setDraft] = useState(() => amountToCashDigits(amount));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!open || focusedRef.current) return;
    setDraft(amountToCashDigits(amount));
  }, [open, amount]);

  const onChange = (raw: string) => {
    const digits = sanitizeCashDigits(raw);
    setDraft(digits);
    setAmount(cashDigitsToAmount(digits));
  };

  const onFocus = (e: FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    requestAnimationFrame(() => {
      e.target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const onBlur = () => {
    focusedRef.current = false;
  };

  return { draft, onChange, onFocus, onBlur };
}
