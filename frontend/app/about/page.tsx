import type { Metadata } from 'next';
import Link from 'next/link';
import LegalDocLayout from '@/components/legal/LegalDocLayout';

export const metadata: Metadata = {
  title: 'About Sabo Studios',
  description:
    'Tycoon is operated by Sabo Studios. Learn about the business behind tycoonworld.xyz.',
};

export default function AboutPage() {
  return (
    <LegalDocLayout title="About Sabo Studios" lastUpdated="August 2026">
      <div className="rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-5 py-4 space-y-3">
        <p className="text-[#C8F0F2] text-sm leading-relaxed">
          <strong className="text-white">Sabo Studios</strong> is the legal business that
          owns and operates <strong className="text-white">Tycoon</strong> (
          <a href="https://www.tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            www.tycoonworld.xyz
          </a>
          ).
        </p>
        <p className="text-[#C8F0F2] text-sm leading-relaxed">
          Tycoon is an on-chain strategy game on Celo. Product branding may say
          &quot;Tycoon&quot;; the operating company is <strong className="text-white">Sabo Studios</strong>.
        </p>
      </div>

      <div className="rounded-2xl border border-[#003B3E]/60 bg-[#0A1A1C]/60 p-5 space-y-2">
        <h2 className="font-orbitron text-sm font-bold text-[#00F0FF] uppercase tracking-wider">
          Legal entity
        </h2>
        <p className="text-[#C8E0E2] text-sm">
          Legal business name: <strong className="text-white">Sabo Studios</strong>
        </p>
        <p className="text-[#C8E0E2] text-sm">
          Website: <strong className="text-white">https://www.tycoonworld.xyz</strong>
        </p>
        <p className="text-[#C8E0E2] text-sm">
          Contact:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>
        </p>
      </div>

      <p className="text-[#8AABAE] text-xs">
        See also{' '}
        <Link href="/terms" className="text-[#00F0FF] hover:underline">
          Terms
        </Link>
        {' · '}
        <Link href="/privacy" className="text-[#00F0FF] hover:underline">
          Privacy
        </Link>
        .
      </p>
    </LegalDocLayout>
  );
}
