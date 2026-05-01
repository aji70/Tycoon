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

export default function CookiesPage() {
  return (
    <LegalDocLayout title="Cookies Policy" lastUpdated="July 2025">

      <section className="space-y-3">
        <S>1. What Are Cookies?</S>
        <p>
          Cookies are small text files placed on your device when you visit a website. They help
          the site remember information about your visit, making it easier to use and more useful
          to you. Similar technologies include local storage, session storage, and tracking pixels.
          This policy covers all such technologies collectively referred to as &quot;cookies&quot;.
        </p>
      </section>

      <section className="space-y-3">
        <S>2. How We Use Cookies</S>
        <p>
          Tycoon uses cookies to operate the platform, remember your preferences, understand how
          you use the Service, and improve your experience. We do not use cookies to build
          advertising profiles or sell your data to third parties.
        </p>
      </section>

      <section className="space-y-3">
        <S>3. Types of Cookies We Use</S>

        <p className="font-semibold text-[#F0F7F7]">3.1 Strictly Necessary Cookies</p>
        <p>
          These cookies are essential for the platform to function. They cannot be disabled. Without
          them, features like authentication, wallet sessions, and game state cannot work.
        </p>
        <Table rows={[
          ['privy-token', 'Strictly Necessary', 'Privy authentication session token', 'Session'],
          ['privy-refresh-token', 'Strictly Necessary', 'Privy session refresh', '7 days'],
          ['wc-session', 'Strictly Necessary', 'WalletConnect session state', 'Session'],
          ['next-auth.session-token', 'Strictly Necessary', 'Next.js authentication session', 'Session'],
          ['__Secure-next-auth.*', 'Strictly Necessary', 'Secure auth cookies', 'Session'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.2 Functional / Preference Cookies</p>
        <p>
          These cookies remember your settings and preferences to personalise your experience.
          They require your consent.
        </p>
        <Table rows={[
          ['tycoon-theme', 'Functional', 'Stores your UI theme preference', '1 year'],
          ['tycoon-sound', 'Functional', 'Stores your sound on/off preference', '1 year'],
          ['tycoon-network', 'Functional', 'Remembers last selected blockchain network', '30 days'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.3 Analytics Cookies</p>
        <p>
          These cookies help us understand how users interact with the platform so we can improve
          it. They collect anonymised or pseudonymised data. They require your consent.
        </p>
        <Table rows={[
          ['_sentry-sc', 'Analytics', 'Sentry error tracking session', 'Session'],
          ['sentry-trace', 'Analytics', 'Sentry performance tracing', 'Session'],
          ['_ga / _gid', 'Analytics', 'Google Analytics (if enabled)', '2 years / 24 hrs'],
        ]} />

        <p className="font-semibold text-[#F0F7F7] mt-4">3.4 Third-Party Cookies</p>
        <p>
          Some third-party services we integrate may set their own cookies. These are governed by
          their respective privacy policies:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Privy</strong> — authentication (privy.io)</li>
          <li><strong>WalletConnect / Reown</strong> — wallet connection</li>
          <li><strong>Flutterwave</strong> — payment processing (flutterwave.com)</li>
          <li><strong>Sentry</strong> — error monitoring (sentry.io)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>4. Local Storage & Session Storage</S>
        <p>
          In addition to cookies, we use browser local storage and session storage to store game
          state, wallet connection data, and user preferences. This data stays on your device and
          is not transmitted to our servers unless explicitly required for gameplay.
        </p>
        <p>
          You can clear local/session storage at any time via your browser&apos;s developer tools
          or settings. Clearing this data may log you out and reset your preferences.
        </p>
      </section>

      <section className="space-y-3">
        <S>5. Your Cookie Choices</S>
        <p>
          You have the following options to control cookies:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Cookie consent banner</strong> — when you first visit, you can accept or
            decline non-essential cookies.
          </li>
          <li>
            <strong>Browser settings</strong> — most browsers allow you to block or delete cookies.
            See your browser&apos;s help documentation for instructions.
          </li>
          <li>
            <strong>Opt-out tools</strong> — for analytics, you can use browser extensions like
            uBlock Origin or the Google Analytics opt-out add-on.
          </li>
        </ul>
        <p>
          Blocking strictly necessary cookies will prevent the Service from functioning correctly.
          Blocking functional cookies will reset your preferences on each visit.
        </p>
      </section>

      <section className="space-y-3">
        <S>6. Do Not Track</S>
        <p>
          Some browsers send a &quot;Do Not Track&quot; (DNT) signal. We currently do not alter our
          data collection practices in response to DNT signals, as there is no universally accepted
          standard for how to respond to them. We will update this policy if that changes.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Updates to This Policy</S>
        <p>
          We may update this Cookies Policy as we add or change technologies. The &quot;Last
          updated&quot; date at the top reflects the most recent revision. Continued use of the
          Service after changes constitutes acceptance.
        </p>
      </section>

      <section className="space-y-3">
        <S>8. Contact</S>
        <p>
          For questions about our use of cookies, contact:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>.
        </p>
      </section>

    </LegalDocLayout>
  );
}
