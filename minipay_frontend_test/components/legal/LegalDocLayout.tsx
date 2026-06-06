'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale } from 'lucide-react';
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
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 border-b border-[#003B3E]/60 bg-[#010F10]/95 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-2 text-[#00F0FF] hover:text-white font-dmSans text-sm font-medium transition-colors px-3 py-2 rounded-lg hover:bg-[#00F0FF]/10 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-1.5 text-[#00F0FF]/60 text-xs font-orbitron uppercase tracking-widest">
            <Scale className="w-3.5 h-3.5" />
            Legal
          </div>
        </div>
      </div>

      {/* Hero header */}
      <div className="border-b border-[#003B3E]/40 bg-gradient-to-b from-[#021a1c] to-[#010F10]">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <h1 className="font-orbitron text-2xl md:text-3xl font-bold text-white mb-2">{title}</h1>
          {lastUpdated && (
            <p className="text-[#8AABAE] text-xs font-dmSans">Last updated: {lastUpdated}</p>
          )}
          {/* Cross-nav pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { href: '/terms', label: 'Terms' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/cookies', label: 'Cookies' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-3 py-1 rounded-full text-xs font-dmSans font-medium border border-[#003B3E] text-[#8AABAE] hover:border-[#00F0FF]/40 hover:text-[#00F0FF] transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <article className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <div className="space-y-6 text-[#D0E8EA] text-sm md:text-[15px] leading-relaxed font-dmSans">
          {children}
        </div>

        {/* Footer contact */}
        <div className="mt-12 pt-6 border-t border-[#003B3E]/40 text-center">
          <p className="text-xs text-[#8AABAE] font-dmSans">
            Questions?{' '}
            <a href="mailto:support@playtycoon.xyz" className="text-[#00F0FF] hover:underline">
              support@playtycoon.xyz
            </a>
            {' · '}
            <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">
              Telegram
            </a>
          </p>
        </div>
      </article>
    </div>
  );
}
