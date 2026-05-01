import LegalDocLayout from '@/components/legal/LegalDocLayout';
import { AlertTriangle, Ban, Gavel, Wallet, ShieldCheck, Megaphone, Copyright, LogOut, AlertCircle, UserCheck, Gamepad2, RefreshCw, Scale, Phone } from 'lucide-react';

const S = ({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center gap-2 mb-3">
    {icon && <span className="text-[#00F0FF] shrink-0">{icon}</span>}
    <h2 className="font-orbitron text-sm font-bold text-[#00F0FF] uppercase tracking-wider">{children}</h2>
  </div>
);

const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-[#003B3E]/60 bg-[#0A1A1C]/60 p-5 space-y-3">
    {children}
  </div>
);

const Ul = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-[#C8E0E2]">
        <span className="text-[#00F0FF]/50 mt-1 shrink-0">›</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms of Service" lastUpdated="May 2026">

      {/* NOT GAMBLING — bold red banner */}
      <div className="rounded-2xl overflow-hidden border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.08)]">
        <div className="bg-red-500/15 px-5 py-3 flex items-center gap-2 border-b border-red-500/30">
          <Ban className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-orbitron text-xs font-bold text-red-300 uppercase tracking-widest">Not a Gambling Platform</span>
        </div>
        <div className="px-5 py-4 bg-red-950/20">
          <p className="text-red-100 text-sm leading-relaxed">
            Tycoon is a <strong className="text-white">skill-based strategy game</strong>. Entry stakes are game participation fees — not bets or wagers. No element of the game constitutes gambling under any applicable definition. If you are in a jurisdiction where blockchain-based games or token transactions are restricted, you must not use this service.
          </p>
        </div>
      </div>

      {/* AGE RESTRICTION — amber banner */}
      <div className="rounded-2xl overflow-hidden border border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.08)]">
        <div className="bg-amber-500/15 px-5 py-3 flex items-center gap-2 border-b border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-orbitron text-xs font-bold text-amber-300 uppercase tracking-widest">Age Restriction — 18+ Only</span>
        </div>
        <div className="px-5 py-4 bg-amber-950/20">
          <p className="text-amber-100 text-sm leading-relaxed">
            You must be at least <strong className="text-white">18 years old</strong> (or the age of majority in your jurisdiction, whichever is higher) to use Tycoon. By accessing or using the service you confirm you meet this requirement. We reserve the right to terminate accounts where age requirements are not met.
          </p>
        </div>
      </div>

      {/* Intro */}
      <div className="rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-5 py-4">
        <p className="text-[#C8F0F2] text-sm leading-relaxed">
          These Terms of Service govern your access to and use of Tycoon, including our website, game, multiplayer rooms, AI modes, tournaments, and all related features (the <strong className="text-white">&quot;Services&quot;</strong>). By using Tycoon you agree to these Terms. If you do not agree, do not use the Services.
        </p>
      </div>

      <Section>
        <S icon={<Gamepad2 size={15} />}>1. The Services</S>
        <p>Tycoon is an on-chain blockchain game with gameplay, multiplayer rooms, AI modes, tournaments, token interactions, and other features. We may update, modify, or add features at any time without prior notice.</p>
      </Section>

      <Section>
        <S icon={<UserCheck size={15} />}>2. Eligibility</S>
        <Ul items={[
          'You must be at least 18 years old (or the age of majority in your jurisdiction).',
          'You must have legal capacity to enter into these Terms.',
          'You must not be in a jurisdiction where blockchain applications or token transactions are prohibited.',
          'You must not be on any government sanctions list.',
          'You are solely responsible for ensuring your use complies with local laws.',
        ]} />
      </Section>

      <Section>
        <S icon={<Wallet size={15} />}>3. Wallets & Blockchain</S>
        <Ul items={[
          'You must connect a compatible cryptocurrency wallet to use certain features.',
          'We do not custody your private keys, seed phrases, or funds. You are fully responsible for wallet security.',
          'All blockchain transactions are irreversible. We are not responsible for lost funds due to user error or network issues.',
          'By interacting with smart contracts shown in the app, you accept their rules and risks.',
          'Network fees, slippage, and blockchain congestion are outside our control.',
        ]} />
      </Section>

      <Section>
        <S icon={<Ban size={15} />}>4. Not a Gambling Platform</S>
        <p>
          Tycoon is a <strong className="text-white">skill-based competitive strategy game</strong>. Entry stakes (where applicable) are participation fees that fund the prize pool — similar to a tournament entry fee. Outcomes are determined by player decisions, strategy, and game mechanics. Tycoon does not operate as a casino, bookmaker, or gambling operator. TYC tokens and USDC are game utility instruments, not financial instruments or securities.
        </p>
        <p className="text-[#8AABAE] text-xs">You are solely responsible for understanding and complying with the laws of your jurisdiction regarding online games, token transactions, and prize competitions.</p>
      </Section>

      <Section>
        <S icon={<Gavel size={15} />}>5. Gameplay, Stakes & In-Game Assets</S>
        <Ul items={[
          'In-game assets and tokens have no guaranteed value and may fluctuate or become worthless.',
          'We do not guarantee any financial return or outcome from playing or staking.',
          'Purchases of perks, collectibles, bundles, and credits are final and non-refundable unless required by applicable consumer protection law.',
          'We reserve the right to modify, rebalance, or remove virtual items at any time.',
        ]} />
      </Section>

      <Section>
        <S icon={<AlertCircle size={15} />}>6. Acceptable Use & Prohibited Conduct</S>
        <p className="text-[#8AABAE] text-xs mb-2">You agree not to:</p>
        <Ul items={[
          'Cheat, hack, exploit bugs, or use unauthorised automation or scripts',
          'Harass, threaten, or abuse other players',
          'Interfere with the Services or other users\' experience',
          'Use the Services for money laundering, fraud, or any illegal purpose',
          'Impersonate others or provide false information',
          'Create multiple accounts to circumvent bans or gain unfair advantages',
          'Reverse-engineer or tamper with smart contracts or the platform',
        ]} />
        <p className="text-[#8AABAE] text-xs mt-2">Violations may result in immediate account suspension and reporting to relevant authorities.</p>
      </Section>

      <Section>
        <S icon={<Megaphone size={15} />}>7. Advertising Policy</S>
        <p>The Service may display third-party advertisements. We are not responsible for advertiser content or practices. We do not serve targeted advertising based on sensitive personal data and will never display gambling advertisements, adult content, or misleading financial promotions.</p>
      </Section>

      <Section>
        <S icon={<Copyright size={15} />}>8. Intellectual Property</S>
        <p>All game content, logos, artwork, and software (excluding your on-chain assets) are owned by Tycoon or its licensors. You are granted a limited, personal, non-exclusive licence for personal entertainment only. You may not copy, modify, or distribute our content without written permission.</p>
      </Section>

      <Section>
        <S icon={<LogOut size={15} />}>9. Termination</S>
        <p>We may suspend or terminate your access at any time, with or without notice, for any reason including violation of these Terms. Upon termination, your right to use the Services ends immediately. Blockchain assets in your wallet remain yours.</p>
      </Section>

      <Section>
        <S icon={<ShieldCheck size={15} />}>10. Disclaimers & Limitation of Liability</S>
        <p className="text-[#8AABAE] text-xs uppercase tracking-wide font-semibold">The services are provided &quot;as is&quot; and &quot;as available&quot; without any warranties, express or implied. To the maximum extent permitted by law, Tycoon and its team disclaim all warranties and shall not be liable for any indirect, incidental, special, or consequential damages, including loss of funds, data, or profits.</p>
        <p>Blockchain and cryptocurrency involve high risk — you use the Services entirely at your own risk. Nothing on this platform constitutes financial, investment, legal, or tax advice.</p>
      </Section>

      <Section>
        <S icon={<UserCheck size={15} />}>11. User Responsibility & Indemnification</S>
        <p className="text-[#8AABAE] text-xs mb-2">You are solely responsible for:</p>
        <Ul items={[
          'All actions taken with your account and wallet',
          'Compliance with laws in your jurisdiction',
          'Any financial decisions made in connection with the game',
          'Any tax obligations arising from token transactions or prizes',
        ]} />
        <p>You agree to indemnify and hold Tycoon harmless from any claims, losses, or damages arising from your use of the Services or breach of these Terms.</p>
      </Section>

      <Section>
        <S icon={<Gamepad2 size={15} />}>12. Responsible Gaming</S>
        <p>
          While Tycoon is not a gambling platform, we encourage responsible engagement. If you feel you are spending excessive time or money on the platform, please take a break. Contact{' '}
          <a href="mailto:support@playtycoon.xyz" className="text-[#00F0FF] hover:underline">support@playtycoon.xyz</a>
          {' '}to request a self-exclusion or account suspension.
        </p>
      </Section>

      <Section>
        <S icon={<RefreshCw size={15} />}>13. Changes to These Terms</S>
        <p>We may update these Terms from time to time. We will post the new version with an updated &quot;Last updated&quot; date. Continued use of the Services after changes means you accept the updated Terms.</p>
      </Section>

      <Section>
        <S icon={<Scale size={15} />}>14. Governing Law & Dispute Resolution</S>
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall first be resolved through good-faith negotiation. If not resolved within 30 days, disputes will be settled by arbitration in Nigeria or as otherwise required by applicable law.</p>
      </Section>

      <Section>
        <S icon={<Phone size={15} />}>15. Contact</S>
        <p>
          For questions or support:{' '}
          <a href="mailto:support@playtycoon.xyz" className="text-[#00F0FF] hover:underline">support@playtycoon.xyz</a>
          {' '}or our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">Telegram community</a>.
        </p>
      </Section>

    </LegalDocLayout>
  );
}
