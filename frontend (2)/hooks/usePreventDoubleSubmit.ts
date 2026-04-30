"use client";

import { useState, useCallback, useRef } from "react";

/**
 * Prevents double-tap / double-click on buttons that call the backend.
 * Returns isSubmitting (true while the async fn is running) and a submit()
 * that runs the given async fn once and blocks re-entry until it completes.
 * Uses a ref so the second tap is blocked immediately (before state flush).
 *
 * Usage:
 *   const { isSubmitting, submit } = usePreventDoubleSubmit();
 *   const handleClick = () => submit(async () => { await apiClient.post(...); });
 *   <button disabled={isSubmitting} onClick={handleClick}>Submit</button>
 */
export function usePreventDoubleSubmit() {
  const [isSubmitting, setSubmitting] = useState(false);
  const guardRef = useRef(false);

  const submit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (guardRef.current) return undefined;
    guardRef.current = true;
    setSubmitting(true);
    try {
      return await fn();
    } finally {
      guardRef.current = false;
      setSubmitting(false);
    }
  }, []);

  return { isSubmitting, submit };
}
