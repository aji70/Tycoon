'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useChainId } from 'wagmi';
import { celo } from 'wagmi/chains';
import { useRegisterPlayer } from '@/context/ContractProvider';
import { GoodDollarClaim } from '@/components/rewards/GoodDollarClaim';

type ProfileOnchainRegisterPromptProps = {
  variant?: 'desktop' | 'mobile';
};

export function ProfileOnchainRegisterPrompt({ variant = 'desktop' }: ProfileOnchainRegisterPromptProps) {
  const chainId = useChainId();
  const [username, setUsername] = useState('');
  const { write: registerPlayer, isPending } = useRegisterPlayer();

  const onCelo = chainId === celo.id;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error('Choose a username');
      return;
    }
    try {
      await registerPlayer(trimmed);
      toast.success('Registration submitted — confirm in your wallet.');
    } catch (err) {
      toast.error((err as Error)?.message || 'Registration failed');
    }
  };

  const shell =
    variant === 'mobile'
      ? 'min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] px-4 py-10'
      : 'min-h-screen bg-gradient-to-br from-[#010F10] via-[#0A1C1E] to-[#0E1415] flex items-center justify-center px-4';

  return (
    <div className={shell}>
      <div className="max-w-md mx-auto rounded-2xl border border-cyan-500/25 bg-[#0E1415]/90 p-6 space-y-4 text-left">
        <h2 className="text-xl font-bold text-white">Register on Tycoon</h2>
        {!onCelo ? (
          <p className="text-sm text-amber-200/90">
            Switch your wallet to <strong>Celo mainnet</strong> to view or create your Tycoon profile.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your wallet is connected, but this address is not registered on Tycoon yet. New wallets (including GoodDollar)
              need a one-time on-chain sign-up — then Profile, Arena, and rewards will load.
            </p>
            <form onSubmit={handleRegister} className="space-y-3">
              <label htmlFor="tycoon-register-username" className="block text-xs font-medium text-cyan-400/80 uppercase tracking-wider">
                Choose username
              </label>
              <input
                id="tycoon-register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. BoardBoss"
                className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/40 text-sm"
                maxLength={32}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-cyan-500/25 border border-cyan-400/40 text-cyan-100 font-semibold text-sm hover:bg-cyan-500/35 disabled:opacity-60"
              >
                {isPending ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" /> Confirm in wallet…
                  </span>
                ) : (
                  'Register on Celo'
                )}
              </button>
            </form>
          </>
        )}
        <p className="text-xs text-slate-500">
          Or register from{' '}
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            Home
          </Link>
          . After confirming, refresh this page.
        </p>
        <div className="pt-2 border-t border-white/10">
          <GoodDollarClaim />
        </div>
      </div>
    </div>
  );
}
