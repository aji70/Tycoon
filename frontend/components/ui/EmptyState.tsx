'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  /** Icon or illustration (e.g. Lucide icon wrapped in a div) */
  icon: React.ReactNode;
  /** Short title (e.g. "No perks yet") */
  title: string;
  /** One or two lines explaining the state */
  description: string;
  /** Primary action: button with label, and either href or onClick */
  action?: EmptyStateAction;
  /** Optional extra class for the container */
  className?: string;
  /** Optional compact mode (less padding) */
  compact?: boolean;
}

/**
 * Standard empty state: icon → title → description → primary CTA.
 * Use for empty lists (perks, vouchers, games, trades) so the experience feels intentional.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'text-center rounded-2xl border border-[#003B3E]/60 bg-[#0E1415]/40 backdrop-blur-sm',
        compact ? 'py-8 px-6' : 'py-12 sm:py-16 px-6 sm:px-8',
        className
      )}
      role="status"
      aria-label={title}
    >
      <div className="flex justify-center mb-4">
        <div
          className={cn(
            'rounded-2xl flex items-center justify-center text-slate-500',
            compact ? 'w-12 h-12' : 'w-16 h-16'
          )}
          aria-hidden
        >
          {icon}
        </div>
      </div>
      <h3
        className={cn(
          'font-semibold text-slate-300 mb-2',
          compact ? 'text-base' : 'text-lg sm:text-xl'
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'text-slate-500 max-w-md mx-auto mb-6',
          compact ? 'text-sm' : 'text-sm sm:text-base'
        )}
      >
        {description}
      </p>
      {action && (
        <>
          {action.href ? (
            <Link
              href={action.href}
              className="inline-flex items-center justify-center rounded-xl font-bold px-6 py-3 bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black hover:shadow-[0_0_24px_rgba(0,240,255,0.35)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415]"
            >
              {action.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-xl font-bold px-6 py-3 bg-gradient-to-r from-[#00F0FF] to-[#0DD6E0] text-black hover:shadow-[0_0_24px_rgba(0,240,255,0.35)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00F0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1415]"
            >
              {action.label}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default EmptyState;
