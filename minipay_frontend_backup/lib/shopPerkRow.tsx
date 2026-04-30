import type { ReactNode } from 'react';
import { getPerkShopAsset } from '@/lib/perkShopAssets';

/** Single row for shop perkMetadata: name + image from perkShopAssets, desc + icon from caller. */
export function shopPerkRow(perk: number, desc: string, icon: ReactNode) {
  const a = getPerkShopAsset(perk);
  if (!a) throw new Error(`perkShopAssets: missing perk ${perk}`);
  return { perk, name: a.name, desc, icon, image: a.image };
}
