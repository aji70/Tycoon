"use client";

import { useEffect } from "react";

/** Loads toast animations + wallet modal overrides after first paint. */
export default function DeferredUiStyles() {
  useEffect(() => {
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const cancel = window.cancelIdleCallback ?? ((id: number) => window.clearTimeout(id));
    const id = ric(() => {
      void import("@/styles/deferred-ui.css");
    }, { timeout: 3000 });
    return () => cancel(id as number);
  }, []);

  return null;
}
