'use client';

import { useEffect, RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * Trap focus inside the container when active. On deactivation, return focus to the triggerRef.
 * Use for modals/dialogs so keyboard users don't tab outside, and focus returns to the trigger on close.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
  triggerRef?: RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusable = getFocusableElements(container);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (first) {
      first.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (triggerRef?.current) {
        triggerRef.current.focus();
      } else if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isActive, containerRef, triggerRef]);
}
