'use client';

import Image from 'next/image';
import { getPerkShopAsset } from '@/lib/perkShopAssets';
import { cn } from '@/lib/utils';

type Props = {
  perk: number;
  /** Tailwind size classes, e.g. w-16 h-16 or w-14 h-14 */
  className?: string;
};

export function ProfilePerkCardImage({ perk, className = 'w-16 h-16' }: Props) {
  const asset = getPerkShopAsset(perk);
  if (!asset) {
    return (
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-xl border border-white/10 bg-gray-500/20 text-2xl text-white/60',
          className
        )}
      >
        ?
      </div>
    );
  }
  return (
    <div className={cn('relative mx-auto overflow-hidden rounded-xl border border-white/10', className)}>
      <Image src={asset.image} alt={asset.name} fill className="object-cover" sizes="80px" />
    </div>
  );
}
