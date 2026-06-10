'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'tycoon_hint_';

export interface FirstTimeHintProps {
  /** Unique key for localStorage (e.g. 'perks_in_game'). Will be prefixed with tycoon_hint_ */
  storageKey: string;
  /** Short message (plain text or JSX). */
  message: React.ReactNode;
  /** Optional link to more info (e.g. { href: '/how-to-play', label: 'How to Play' }) */
  link?: { href: string; label: string };
  /** Optional callback when dismissed (e.g. to refetch). */
  onDismiss?: () => void;
  className?: string;
  /** Compact style (smaller padding). */
  compact?: boolean;
}

export function FirstTimeHint({
  storageKey,
  message,
  link,
  onDismiss,
  className,
  compact = false,
}: FirstTimeHintProps) {
  const fullKey = `${STORAGE_PREFIX}${storageKey}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem(fullKey);
      if (!seen) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, [fullKey]);

  const handleDismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(fullKey, '1');
    } catch {
      // ignore
    }
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cn(
          'flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 px-4 py-3 text-sm text-cyan-200/95',
          compact ? 'py-2 px-3' : 'px-4 py-3',
          className
        )}
        role="status"
        aria-live="polite"
      >
        <span className="flex-1 min-w-0">{message}</span>
        {link && (
          <Link
            href={link.href}
            className="shrink-0 font-semibold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
          >
            {link.label}
          </Link>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss hint"
          className="shrink-0 p-1 rounded-lg text-cyan-400/80 hover:text-cyan-200 hover:bg-cyan-500/20 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

export default FirstTimeHint;
