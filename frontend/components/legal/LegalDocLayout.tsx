'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function LegalDocLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const navigatingRef = useRef(false);

  const handleBack = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back();
      } else {
        router.push('/');
      }
    } catch {
      router.push('/');
    } finally {
      setTimeout(() => { navigatingRef.current = false; }, 500);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#010F10] text-[#F0F7F7]">
      <div className="sticky top-0 z-20 border-b border-[#003B3E]/60 bg-[#010F10]/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#00F0FF] hover:text-[#00F0FF]/80 font-dmSans text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <span className="game-badge text-xs">LEGAL</span>
        </div>
      </div>
      <article className="max-w-3xl mx-auto px-4 py-10 pb-20">
        <h1 className="font-orbitron text-2xl md:text-3xl text-[#00F0FF] mb-2">{title}</h1>
        {lastUpdated && (
          <p className="text-[#8AABAE] text-xs font-dmSans mb-6">Last updated: {lastUpdated}</p>
        )}
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-dmSans text-[#8AABAE] mb-10 border-b border-[#003B3E]/40 pb-4">
          <Link href="/terms" className="hover:text-[#00F0FF] transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[#00F0FF] transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/cookies" className="hover:text-[#00F0FF] transition-colors">Cookies Policy</Link>
        </nav>
        <div className="space-y-8 text-[#E0E7E9] text-sm md:text-[15px] leading-relaxed font-dmSans">
          {children}
        </div>
        <p className="mt-12 text-xs text-[#8AABAE] font-dmSans border-t border-[#003B3E]/40 pt-6">
          Questions? Contact us at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">support@tycoonworld.xyz</a>
          {' '}or via our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">Telegram community</a>.
        </p>
      </article>
    </div>
  );
}
