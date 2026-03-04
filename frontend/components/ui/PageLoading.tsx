'use client';

import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { cn } from '@/lib/utils';

export interface PageLoadingProps {
  /** Optional message below the spinner */
  message?: string;
  className?: string;
  /** Use for full-viewport centering (e.g. game loading) */
  fullScreen?: boolean;
}

/**
 * Full-page or block-level loading state. Use for route-level or panel-level loading.
 * For game room / lobby loading with copy, use GameRoomLoading instead.
 */
export function PageLoading({
  message,
  className,
  fullScreen = false,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        fullScreen && 'min-h-[50vh]',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={message ?? 'Loading'}
    >
      <LoadingSpinner size="lg" variant="cyan" />
      {message && (
        <p className="text-slate-400 text-sm md:text-base">{message}</p>
      )}
    </div>
  );
}

export default PageLoading;
