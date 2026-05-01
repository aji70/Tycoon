import LegalDocLayout from '@/components/legal/LegalDocLayout';
import { Cookie, Settings, BarChart2, Users, HardDrive, SlidersHorizontal, Radio, RefreshCw, Phone } from 'lucide-react';

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

const Ul = ({ items }: { items: (string | React.ReactNode)[] }) => (
  <ul className="space-y-1.5">
    {items.map((item, i) => (
      <li key={i} className="flex items-start gap-2 text-[#C8E0E2]">
        <span className="text-[#00F0FF]/50 mt-1 shrink-0">›</span>
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const CookieTable = ({ label, badge, badgeColor, rows }: {
  label: string;
  badge: string;
  badgeColor: string;
  rows: [string, string, string][];
}) => (
  <div className="rounded-xl overflow-hidden border border-[#003B3E]/60">
    <div className={`px-4 py-2 flex items-center justify-between ${badgeColor}`}>
      <span className="text-xs font-orbitron font-bold text-white uppercase tracking-wider">{label}</span>
      <span className="text-[10px] text-white/60">{badge}</span>
    </div>
    <table className="w-full text-xs font-dmSans">
      <thead>
        <tr className="bg-[#003B3E]/30 text-[#00F0FF]/70">
          <th className="text-left px-3 py-2">Cookie</th>
          <th className="text-left px-3 py-2">Purpose</th>
          <th className="text-left px-3 py-2 whitespace-nowrap">Duration</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, purpose, duration], i) => (
          <tr key={i} className="border-t border-[#003B3E]/40 text-[#C8F0F2]">
            <td className="px-3 py-2 font-mono text-[11px]">{name}</td>
            <td className="px-3 py-2">{purpose}</td>
            <td className="px-3 py-2 whitespace-nowrap text-[#8AABAE]">{duration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function CookiesPage() {
  return (
    <LegalDocLayout title="Cookies Policy" lastUpdated="July 2025">

      <div className="rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-5 py-4">
        <p className="text-[#C8F0F2] text-sm leading-relaxed">
          This Cookies Policy explains how Tycoon uses cookies and similar technologies when you visit or use our website, game, or services (the <strong className="text-white">&quot;Services&quot;</strong>). For full details on how we process your data, see our{' '}
          <a href="/privacy" className="text-[#00F0FF] hover:underline">Privacy Policy</a>.
          By using our Services, you consent to the use of cookies as described here.
        </p>
      </div>

      <Section>
        <S icon={<Cookie size={15} />}>1. What Are Cookies?</S>
        <p className="text-[#C8E0E2]">
          Cookies are small text files placed on your device when you visit a website. They help the site remember information about your visit, making it easier and more useful for you. This policy also covers similar technologies such as local storage, session storage, tracking pixels, and scripts.
        </p>
      </Section>

      <Section>
        <S icon={<Settings size={15} />}>2. How We Use Cookies</S>
        <Ul items={[
          'Operate the platform and enable core features (authentication, wallet connection, gameplay)',
          'Remember your preferences and settings',
          'Understand how users interact with the Services',
          'Improve performance, security, and your overall experience',
        ]} />
        <p className="text-[#8AABAE] text-xs">We do not use cookies to build advertising profiles or sell your personal data to third parties.</p>
      </Section>

      <Section>
        <S icon={<BarChart2 size={15} />}>3. Types of Cookies We Use</S>

        <CookieTable
          label="Strictly Necessary"
          badge="Cannot be disabled"
          badgeColor="bg-[#003B3E]/80"
          rows={[
            ['privy-token', 'Privy authentication session', 'Session'],
            ['privy-refresh-token', 'Privy session refresh', '7 days'],
            ['wc-session', 'WalletConnect session state', 'Session'],
            ['next-auth.session-token', 'Next.js authentication session', 'Session'],
            ['__Secure-next-auth.*', 'Secure authentication cookies', 'Session'],
          ]}
        />

        <CookieTable
          label="Functional / Preference"
          badge="Requires consent"
          badgeColor="bg-indigo-900/60"
          rows={[
            ['tycoon-theme', 'Stores your UI theme preference', '1 year'],
            ['tycoon-sound', 'Stores your sound on/off preference', '1 year'],
            ['tycoon-network', 'Remembers last selected blockchain network', '30 days'],
          ]}
        />

        <CookieTable
          label="Analytics"
          badge="Requires consent"
          badgeColor="bg-purple-900/60"
          rows={[
            ['_sentry-sc', 'Sentry error tracking session', 'Session'],
            ['sentry-trace', 'Sentry performance tracing', 'Session'],
            ['_ga / _gid', 'Google Analytics (if enabled)', '2 yrs / 24 hrs'],
          ]}
        />

        <div className="rounded-xl border border-[#003B3E]/60 bg-[#011112]/60 p-4">
          <p className="text-xs font-orbitron font-bold text-[#00F0FF]/70 uppercase tracking-wider mb-2">Third-Party Cookies</p>
          <Ul items={[
            <><strong className="text-white">Privy</strong> — Authentication (<a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">privy.io</a>)</>,
            <><strong className="text-white">WalletConnect / Reown</strong> — Wallet connection</>,
            <><strong className="text-white">Flutterwave</strong> — Payment processing (<a href="https://flutterwave.com" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">flutterwave.com</a>)</>,
            <><strong className="text-white">Sentry</strong> — Error monitoring (<a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">sentry.io</a>)</>,
          ]} />
        </div>
      </Section>

      <Section>
        <S icon={<HardDrive size={15} />}>4. Local Storage &amp; Session Storage</S>
        <p className="text-[#C8E0E2]">
          We also use browser local storage and session storage to save game state, wallet connection data, and preferences. This data stays on your device and is not sent to our servers unless needed for gameplay.
        </p>
        <p className="text-[#8AABAE] text-xs">You can clear local or session storage at any time through your browser settings. Doing so may log you out and reset your preferences.</p>
      </Section>

      <Section>
        <S icon={<SlidersHorizontal size={15} />}>5. Your Cookie Choices</S>
        <Ul items={[
          <><strong className="text-white">Cookie consent banner</strong> — on your first visit you can accept or decline non-essential cookies</>,
          <><strong className="text-white">Browser settings</strong> — most browsers let you block or delete cookies (check your browser&apos;s help section)</>,
          <><strong className="text-white">Opt-out tools</strong> — for analytics, use extensions like uBlock Origin or the Google Analytics opt-out add-on</>,
        ]} />
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5">
          <p className="text-amber-200 text-xs"><strong>Important:</strong> Blocking strictly necessary cookies will stop the Services from working properly.</p>
        </div>
      </Section>

      <Section>
        <S icon={<Radio size={15} />}>6. Do Not Track Signals</S>
        <p className="text-[#C8E0E2]">
          Some browsers send a &quot;Do Not Track&quot; (DNT) signal. We do not currently change our data practices in response to DNT signals because there is no industry-wide standard. We will update this policy if that changes.
        </p>
      </Section>

      <Section>
        <S icon={<RefreshCw size={15} />}>7. Updates to This Policy</S>
        <p className="text-[#C8E0E2]">We may update this Cookies Policy when we add or change technologies. The &quot;Last updated&quot; date at the top shows the latest version. Continued use of the Services after changes means you accept the updated policy.</p>
      </Section>

      <Section>
        <S icon={<Phone size={15} />}>8. Contact</S>
        <p className="text-[#C8E0E2]">
          For any questions about our use of cookies:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">support@tycoonworld.xyz</a>
          {' '}or our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">Telegram community</a>.
        </p>
      </Section>

    </LegalDocLayout>
  );
}
