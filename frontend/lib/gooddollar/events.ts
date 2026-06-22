export const GOODDOLLAR_UPDATED_EVENT = 'tycoon:gooddollar-updated';

export function dispatchGoodDollarUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(GOODDOLLAR_UPDATED_EVENT));
}
