'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const baseSkeleton = 'animate-pulse bg-slate-700/50 rounded';

/** Single line of skeleton text */
export function SkeletonLine({
  className,
  width = 'full',
}: {
  className?: string;
  width?: 'full' | '3/4' | '2/3' | '1/2' | '1/3';
}) {
  return (
    <div
      className={cn(
        baseSkeleton,
        'h-4',
        width === 'full' && 'w-full',
        width === '3/4' && 'w-3/4',
        width === '2/3' && 'w-2/3',
        width === '1/2' && 'w-1/2',
        width === '1/3' && 'w-1/3',
        className
      )}
    />
  );
}

/** Skeleton for a generic card (image area + content lines) */
export function SkeletonCard({
  className,
  lines = 2,
  hasImage = true,
  imageHeight = 'h-48',
}: {
  className?: string;
  lines?: number;
  hasImage?: boolean;
  imageHeight?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl overflow-hidden border border-[#003B3E]/60 bg-[#0E1415]/40',
        className
      )}
    >
      {hasImage && (
        <div
          className={cn(baseSkeleton, 'w-full flex-shrink-0', imageHeight)}
        />
      )}
      <div className="p-5 flex flex-col gap-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonLine
            key={i}
            width={i === 0 ? 'full' : i === lines - 1 ? '1/2' : '3/4'}
          />
        ))}
      </div>
    </div>
  );
}

/** Skeleton matching the Shop perk card layout: image 12rem, then title + description + price area */
export function SkeletonPerkCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl overflow-hidden border border-[#003B3E]/60 bg-[#0E1415]/40',
        className
      )}
    >
      <div className={cn(baseSkeleton, 'h-48 min-h-[12rem] w-full')} />
      <div className="p-5 flex flex-col flex-1 gap-3">
        <SkeletonLine width="full" className="h-5" />
        <SkeletonLine width="full" />
        <SkeletonLine width="3/4" />
        <div className="mt-4 flex justify-between items-end gap-4">
          <div className="space-y-1">
            <SkeletonLine width="1/3" className="h-3" />
            <SkeletonLine width="1/2" className="h-6" />
          </div>
        </div>
        <div className={cn(baseSkeleton, 'h-12 w-full rounded-xl mt-2')} />
      </div>
    </div>
  );
}

/** Skeleton for Join room game card: code + players line + button area */
export function SkeletonGameCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-[#00F0FF]/20 bg-[#010F10]/70 p-5 gap-4',
        className
      )}
    >
      <div className="text-center space-y-2">
        <SkeletonLine width="1/2" className="h-5 mx-auto" />
        <SkeletonLine width="2/3" className="h-4 mx-auto" />
      </div>
      <div className={cn(baseSkeleton, 'h-10 w-24 rounded-lg mx-auto')} />
    </div>
  );
}

/** Grid of skeleton perk cards for Shop / Profile perks */
export function SkeletonPerkGrid({
  count = 6,
  className,
  gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-x-4 gap-y-6',
}: {
  count?: number;
  className?: string;
  gridClass?: string;
}) {
  return (
    <div className={cn(gridClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonPerkCard key={i} />
      ))}
    </div>
  );
}

/** Grid of skeleton game cards for Join room */
export function SkeletonGameGrid({
  count = 6,
  className,
  gridClass = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4',
}: {
  count?: number;
  className?: string;
  gridClass?: string;
}) {
  return (
    <div className={cn(gridClass, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonGameCard key={i} />
      ))}
    </div>
  );
}
