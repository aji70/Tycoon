"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * When the user tries create / continue / join-public without a session, we open a modal and
 * store a callback; after `canAct` becomes true (wallet or backend guest JWT), run it once.
 */
export function useJoinRoomAuthContinuation(canAct: boolean) {
  const pending = useRef<(() => void) | null>(null);
  const [modalOpen, setModalOpenState] = useState(false);
  const [modalHint, setModalHint] = useState("");

  useEffect(() => {
    if (!canAct || !pending.current) return;
    const fn = pending.current;
    pending.current = null;
    setModalOpenState(false);
    fn();
  }, [canAct]);

  const queueAfterAuth = useCallback((hint: string, fn: () => void) => {
    if (canAct) {
      fn();
      return;
    }
    pending.current = fn;
    setModalHint(hint);
    setModalOpenState(true);
  }, [canAct]);

  const cancelModal = useCallback(() => {
    pending.current = null;
    setModalOpenState(false);
  }, []);

  return { modalOpen, modalHint, queueAfterAuth, cancelModal };
}
