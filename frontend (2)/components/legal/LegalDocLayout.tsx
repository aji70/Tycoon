'use client';

import { useCallback, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function LegalDocLayout({
  title,
  children,
}: {
  title: string;
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
      setTimeout(() => {
        navigatingRef.current = false;
      }, 500);
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
        <h1 className="font-orbitron text-2xl md:text-3xl text-[#00F0FF] mb-3">{title}</h1>
        <p className="text-amber-200/95 text-sm border border-amber-500/35 rounded-xl p-4 mb-10 bg-amber-950/25 font-dmSans leading-relaxed">
          <strong>Draft.</strong> This page is a placeholder until attorney-reviewed terms or privacy
          language is in place. It is not legal advice.
        </p>
        <div className="space-y-8 text-[#E0E7E9] text-sm md:text-[15px] leading-relaxed font-dmSans">
          {children}
        </div>
      </article>
    </div>
  );
}
