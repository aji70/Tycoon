import { ensureInjectedMiniPayConnection } from '@/lib/minipayGuestFlow';

/** Connect injected MiniPay provider (use from click handlers). */
export async function connectMiniPayWallet(): Promise<void> {
  await ensureInjectedMiniPayConnection();
}
