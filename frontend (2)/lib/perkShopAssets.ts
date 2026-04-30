/** Perk card art under /public/shopcards — shared by game shop and profile "My Perks". */
export const PERK_SHOP_ASSETS: Record<number, { name: string; image: string }> = {
  1: { name: 'Extra Turn', image: '/shopcards/extraturn.jpg' },
  2: { name: 'Jail Free Card', image: '/shopcards/jailfree.jpg' },
  3: { name: 'Double Rent', image: '/shopcards/double_rent.jpg' },
  4: { name: 'Roll Boost', image: '/shopcards/roll_boost.jpg' },
  5: { name: 'Instant Cash', image: '/shopcards/Cash_tiered.jpg' },
  6: { name: 'Teleport', image: '/shopcards/teleport.jpg' },
  7: { name: 'Shield', image: '/shopcards/rent_immunity.jpg' },
  8: { name: 'Property Discount', image: '/shopcards/Cash_tiered.jpg' },
  9: { name: 'Tax Refund', image: '/shopcards/tax_refund.jpg' },
  10: { name: 'Exact Roll', image: '/shopcards/roll_boost.jpg' },
  11: { name: 'Rent Cashback', image: '/shopcards/rent_cashback.jpg' },
  12: { name: 'Interest', image: '/shopcards/interest.jpg' },
  13: { name: 'Lucky 7', image: '/shopcards/lucky_7.jpg' },
  14: { name: 'Free Parking Bonus', image: '/shopcards/freeparking_bonus.jpg' },
};

export function getPerkShopAsset(perk: number): { name: string; image: string } | undefined {
  return PERK_SHOP_ASSETS[perk];
}
