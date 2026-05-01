import LegalDocLayout from '@/components/legal/LegalDocLayout';

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-orbitron text-base text-[#00F0FF] mt-2">{children}</h2>
);

const Table = ({ rows }: { rows: [string, string, string, string][] }) => (
  <div className="overflow-x-auto rounded-xl border border-[#003B3E]/60">
    <table className="w-full text-xs font-dmSans">
      <thead>
        <tr className="bg-[#003B3E]/40 text-[#00F0FF]">
          <th className="text-left px-3 py-2">Cookie / Technology</th>
          <th className="text-left px-3 py-2">Type</th>
          <th className="text-left px-3 py-2">Purpose</th>
          <th className="text-left px-3 py-2">Duration</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, type, purpose, duration], i) => (
          <tr key={i} className="border-t border-[#003B3E]/40 text-[#C8F0F2]">
            <td className="px-3 py-2 font-mono">{name}</td>
            <td className="px-3 py-2">{type}</td>
            <td className="px-3 py-2">{purpose}</td>
            <td className="px-3 py-2">{duration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Info = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-[#00F0FF]/25 bg-[#00F0FF]/5 rounded-xl p-4 text-[#C8F0F2] text-sm font-dmSans leading-relaxed">
    {children}
  </div>
);

export default function CookiesPage() {
  return (
    <LegalDocLayout title="Cookies Policy" lastUpdated="July 2025">

      <Info>
        This Cookies Policy explains how Tycoon (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
        uses cookies and similar technologies when you visit or use our website, game, or services
        (the &quot;Services&quot;). For full details on how we process your data, please also read
        our{' '}
        <a href="/privacy" className="text-[#00F0FF] hover:underline">Privacy Policy</a>.
        By using our Services, you consent to the use of cookies as described in this policy.
      </Info>

      <section className="space-y-3">
        <S>1. What Are Cookies?</S>
        <p>
          Cookies are small text files placed on your device when you visit a website. They help
          the site remember information about your visit, making it easier and more useful for you.
          This policy also covers similar technologies such as local storage, session storage,
          tracking pixels, and scripts.
        </p>
      </section>

      <section className="space-y-3">
        <S>2. How We Use Cookies</S>
        <p>We use cookies to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Operate the platform and enable core features (authentication, wallet connection, gameplay)</li>
          <li>Remember your preferences and settings</li>
          <li>Understand how users interact with the Services</li>
          <li>Improve performance, security, and your overall experience</li>
        </ul>
        <p>
          We do not use cookies to build advertising profiles or sell your personal data to
          third parties.
        </p>
      </section>

      <section className="space-y-3">
        <S>3. Types of Cookies We Use</S>

        <p className="font-semibold text-[#F0F7F7]">3.1 Strictly Necessary Cookies</p>
        <p>These cookies are essential for the Services to work. They cannot be disabled.</p>
        <Table rows={[
          ['privy-token', 'Strictly Necessary', 'Privy authentication session', 'Session'],
          ['privy-refresh-token', 'Strictly Necessary', 'Privy session refresh', '7 days'],
          ['wc-session', 'Strictly Necessary', 'WalletConnect session state', 'Session'],
          ['next-auth.session-token', 'Strictly Necessary', 'Next.js authentication session', 'Session'],
          ['__Secure-next-auth.*', 'Strictly Necessary', 'Secure authentication cookies', 'Session'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.2 Functional / Preference Cookies</p>
        <p>These remember your settings to personalise your experience. They require your consent.</p>
        <Table rows={[
          ['tycoon-theme', 'Functional', 'Stores your UI theme preference', '1 year'],
          ['tycoon-sound', 'Functional', 'Stores your sound on/off preference', '1 year'],
          ['tycoon-network', 'Functional', 'Remembers last selected blockchain network', '30 days'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.3 Analytics Cookies</p>
        <p>
          These help us understand usage and improve the Services. They collect anonymised or
          pseudonymised data and require your consent.
        </p>
        <Table rows={[
          ['_sentry-sc', 'Analytics', 'Sentry error tracking session', 'Session'],
          ['sentry-trace', 'Analytics', 'Sentry performance tracing', 'Session'],
          ['_ga / _gid', 'Analytics', 'Google Analytics (if enabled)', '2 years / 24 hrs'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.4 Third-Party Cookies</p>
        <p>
          Some third-party services we use may set their own cookies, governed by their own
          privacy policies:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Privy</strong> — Authentication (<a href="https://privy.io" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">privy.io</a>)</li>
          <li><strong>WalletConnect / Reown</strong> — Wallet connection</li>
          <li><strong>Flutterwave</strong> — Payment processing (<a href="https://flutterwave.com" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">flutterwave.com</a>)</li>
          <li><strong>Sentry</strong> — Error monitoring (<a href="https://sentry.io" target="_blank" rel="noopener noreferrer" className="text-[#00F0FF] hover:underline">sentry.io</a>)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>4. Local Storage &amp; Session Storage</S>
        <p>
          We also use browser local storage and session storage to save game state, wallet
          connection data, and preferences. This data stays on your device and is not sent to our
          servers unless needed for gameplay.
        </p>
        <p>
          You can clear local or session storage at any time through your browser settings. Doing
          so may log you out and reset your preferences.
        </p>
      </section>

      <section className="space-y-3">
        <S>5. Your Cookie Choices</S>
        <p>You control cookies in these ways:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Cookie consent banner</strong> — on your first visit you can accept or decline non-essential cookies.</li>
          <li><strong>Browser settings</strong> — most browsers let you block or delete cookies (check your browser&apos;s help section).</li>
          <li><strong>Opt-out tools</strong> — for analytics, you can use extensions like uBlock Origin or the Google Analytics opt-out add-on.</li>
        </ul>
        <p>
          <strong>Important:</strong> Blocking strictly necessary cookies will stop the Services
          from working properly.
        </p>
      </section>

      <section className="space-y-3">
        <S>6. Do Not Track Signals</S>
        <p>
          Some browsers send a &quot;Do Not Track&quot; (DNT) signal. We do not currently change
          our data practices in response to DNT signals because there is no industry-wide standard.
          We will update this policy if that changes.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Updates to This Policy</S>
        <p>
          We may update this Cookies Policy when we add or change technologies. The &quot;Last
          updated&quot; date at the top shows the latest version. Continued use of the Services
          after changes means you accept the updated policy.
        </p>
      </section>

      <section className="space-y-3">
        <S>8. Contact</S>
        <p>
          For any questions about our use of cookies:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>
          {' '}or our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">
            Telegram community
          </a>.
        </p>
      </section>

    </LegalDocLayout>
  );
}
