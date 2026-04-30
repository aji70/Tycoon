'use client';

import { useEffect } from 'react';

const BOARD_ROUTES = ['/board-3d-mobile', '/board-3d-multi-mobile'];

/**
 * When the user presses the device back button and the browser restores a board page from bfcache,
 * WebGL context is lost and R3F's connect() throws (reading 'style' on detached node).
 * We avoid that by doing a full page reload when we detect board restored from bfcache,
 * so the board loads fresh with a new WebGL context.
 */
export default function BfcacheReloadGuard() {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const path = typeof window !== 'undefined' ? window.location.pathname : '';
      const isBoard = BOARD_ROUTES.some((r) => path.startsWith(r) || path.includes(r));
      if (isBoard) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  return null;
}
