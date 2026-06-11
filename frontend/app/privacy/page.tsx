import LegalDocLayout from '@/components/legal/LegalDocLayout';
import { Database, Wallet, Mail, BarChart2, Share2, Globe, Clock, ShieldCheck, Lock, Baby, RefreshCw, Phone, Scale, Cookie } from 'lucide-react';

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

const Highlight = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-4 py-3 text-[#C8F0F2] text-sm leading-relaxed">
    {children}
  </div>
);

const RightBadge = ({ label }: { label: string }) => (
  <span className="inline-block px-2 py-0.5 rounded-md bg-[#003B3E]/80 border border-[#00F0FF]/20 text-[#00F0FF] text-xs font-dmSans mr-1 mb-1">
    {label}
  </span>
);

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy" lastUpdated="May 2026">

      <div className="rounded-2xl border border-[#00F0FF]/20 bg-[#00F0FF]/5 px-5 py-4">
        <p className="text-[#C8F0F2] text-sm leading-relaxed">
          This Privacy Policy explains how Tycoon (<strong className="text-white">&quot;we&quot;</strong>, <strong className="text-white">&quot;us&quot;</strong>, or <strong className="text-white">&quot;our&quot;</strong>) collects, uses, and protects your information when you use our website, game, or services (the <strong className="text-white">&quot;Services&quot;</strong>). We follow international best practices including Nigeria&apos;s NDPA 2023, GDPR, and CCPA/CPRA. By using our Services you agree to the practices described here.
        </p>
      </div>

      <Section>
        <S icon={<Database size={15} />}>1. Information We Collect</S>

        <p className="text-xs font-semibold text-[#00F0FF]/70 uppercase tracking-wider">a. Blockchain &amp; Wallet Data</p>
        <Ul items={[
          'Your public wallet address',
          'On-chain transactions, token balances, NFT holdings, and interactions',
        ]} />
        <Highlight>
          <strong>Important:</strong> Blockchain data is public, permanent, and immutable. We cannot delete or hide any information recorded on the ledger.
        </Highlight>

        <p className="text-xs font-semibold text-[#00F0FF]/70 uppercase tracking-wider pt-1">b. Account &amp; Sign-in Data</p>
        <Ul items={[
          'Email address or other login identifier (if you sign in via Privy)',
          'Authentication tokens and session data',
        ]} />

        <p className="text-xs font-semibold text-[#00F0FF]/70 uppercase tracking-wider pt-1">c. Game &amp; Usage Data</p>
        <Ul items={[
          'Gameplay activity, progress, and interactions',
          'Device information (type, OS, browser version)',
          'IP address (for security, fraud prevention, and region detection)',
          'Error logs, crash reports, and performance metrics',
          'Cookies and similar technologies — see our Cookies Policy',
        ]} />

        <p className="text-xs font-semibold text-[#00F0FF]/70 uppercase tracking-wider pt-1">d. Other Information</p>
        <p className="text-[#C8E0E2]">Any data you voluntarily provide when contacting support or giving feedback.</p>
      </Section>

      <Section>
        <S icon={<BarChart2 size={15} />}>2. How We Use Your Information</S>
        <Ul items={[
          'Operate and improve the Tycoon game',
          'Enable wallet connectivity and blockchain features',
          'Provide account security and session management',
          'Analyse gameplay trends and fix bugs',
          'Prevent fraud and abuse',
          'Respond to your support requests',
          'Comply with legal obligations',
        ]} />
      </Section>

      <Section>
        <S icon={<Scale size={15} />}>3. Legal Basis &amp; Consent</S>
        <p className="text-[#8AABAE] text-xs mb-1">We process your data based on:</p>
        <Ul items={[
          <><strong className="text-white">Your consent</strong> — by connecting a wallet, signing in, or continuing to play</>,
          <><strong className="text-white">Performance of contract</strong> — to deliver the game and its features to you</>,
          <><strong className="text-white">Legitimate interests</strong> — security, service improvement, and fraud prevention</>,
          <><strong className="text-white">Legal obligation</strong> — to comply with applicable laws</>,
        ]} />
        <p className="text-[#C8E0E2]">You can withdraw consent at any time by stopping use of the Services. This does not affect already-public blockchain data, which is immutable.</p>
      </Section>

      <Section>
        <S icon={<Share2 size={15} />}>4. Sharing Your Information</S>
        <p className="text-[#8AABAE] text-xs mb-1">We share data only when necessary:</p>
        <Ul items={[
          <><strong className="text-white">Trusted service providers</strong> — authentication (Privy), analytics, hosting, crash reporting (Sentry), and payments (Flutterwave) — all bound by data protection agreements</>,
          <><strong className="text-white">Legal requirement</strong> — when required by law or government request</>,
          <><strong className="text-white">Business transfer</strong> — in the event of a merger or acquisition, with notice where required by law</>,
        ]} />
        <Highlight><strong>We never sell your personal data for marketing.</strong> On-chain activity remains publicly visible to anyone on the blockchain.</Highlight>
      </Section>

      <Section>
        <S icon={<Globe size={15} />}>5. International Data Transfers</S>
        <p className="text-[#C8E0E2]">
          Tycoon is a global service. Your data may be transferred and processed outside your country — including to servers in the United States, Europe, Nigeria, or other locations. We use appropriate safeguards (such as Standard Contractual Clauses where required) to protect your data during these transfers in compliance with GDPR, NDPA 2023, and other applicable frameworks.
        </p>
      </Section>

      <Section>
        <S icon={<Clock size={15} />}>6. Data Retention</S>
        <Ul items={[
          'Account data — while active and up to 2 years after deletion',
          'Transaction records — up to 7 years for legal/tax compliance',
          'Error logs — up to 90 days',
          'Marketing data — until you withdraw consent',
        ]} />
        <p className="text-[#C8E0E2]">You may request deletion of personal data we control by contacting support. Blockchain data cannot be deleted.</p>
      </Section>

      <Section>
        <S icon={<ShieldCheck size={15} />}>7. Your Rights</S>
        <p className="text-[#8AABAE] text-xs mb-2">Depending on where you live (EU/EEA, UK, Nigeria, California, or elsewhere):</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {['Access', 'Rectification', 'Erasure', 'Restriction', 'Portability', 'Object', 'Withdraw Consent', 'Do Not Sell'].map(r => (
            <RightBadge key={r} label={r} />
          ))}
        </div>
        <p className="text-[#C8E0E2]">
          To exercise any right, contact us at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">support@tycoonworld.xyz</a>.
          {' '}We will respond within 30 days.
        </p>
      </Section>

      <Section>
        <S icon={<Cookie size={15} />}>8. Cookies &amp; Tracking</S>
        <p className="text-[#C8E0E2]">
          We use cookies and similar technologies for authentication, preferences, and analytics. For full details including a cookie table and your opt-out options, see our{' '}
          <a href="/cookies" className="text-[#00F0FF] hover:underline">Cookies Policy</a>.
        </p>
        <Highlight><strong>Do Not Sell / Do Not Share:</strong> We do not sell or share personal data with third parties for cross-context behavioural advertising.</Highlight>
      </Section>

      <Section>
        <S icon={<Lock size={15} />}>9. Security</S>
        <p className="text-[#C8E0E2]">
          We use reasonable technical and organisational measures (TLS encryption, access controls, regular security reviews) to protect your data. However, no system is 100% secure. Public blockchain data is outside our control. You are responsible for securing your wallet keys and login credentials.
        </p>
        <p className="text-[#C8E0E2]">
          In the event of a data breach posing risk to your rights, we will notify affected users and relevant authorities as required by applicable law.
        </p>
      </Section>

      <Section>
        <S icon={<Baby size={15} />}>10. Children&apos;s Privacy</S>
        <p className="text-[#C8E0E2]">
          Our Services are strictly for users aged <strong className="text-white">18 and over</strong> (see our{' '}
          <a href="/terms" className="text-[#00F0FF] hover:underline">Terms of Service</a>).
          We do not knowingly collect personal data from anyone under 18. If you believe a minor has registered, contact us immediately at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">support@tycoonworld.xyz</a>
          {' '}and we will delete the data promptly.
        </p>
      </Section>

      <Section>
        <S icon={<RefreshCw size={15} />}>11. Changes to This Policy</S>
        <p className="text-[#C8E0E2]">We may update this Privacy Policy. Material changes will be posted with a new &quot;Last updated&quot; date. Continued use of the Services after changes constitutes acceptance of the updated policy.</p>
      </Section>

      <Section>
        <S icon={<Phone size={15} />}>12. Contact &amp; Supervisory Authorities</S>
        <p className="text-[#C8E0E2]">
          For questions, data requests, or complaints:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">support@tycoonworld.xyz</a>
          {' '}or our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">Telegram community</a>.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          {[
            { region: 'EU / EEA', body: 'Your national Data Protection Authority' },
            { region: 'Nigeria', body: 'Nigeria Data Protection Commission (NDPC)' },
            { region: 'California', body: 'CCPA/CPRA rights via contact above' },
          ].map(({ region, body }) => (
            <div key={region} className="rounded-xl border border-[#003B3E]/60 bg-[#011112]/60 px-3 py-2.5">
              <p className="text-[10px] font-orbitron text-[#00F0FF]/60 uppercase tracking-wider mb-0.5">{region}</p>
              <p className="text-xs text-[#C8E0E2]">{body}</p>
            </div>
          ))}
        </div>
      </Section>

    </LegalDocLayout>
  );
}
