import LegalDocLayout from '@/components/legal/LegalDocLayout';

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-orbitron text-base text-[#00F0FF] mt-2">{children}</h2>
);

const Info = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-[#00F0FF]/25 bg-[#00F0FF]/5 rounded-xl p-4 text-[#C8F0F2] text-sm font-dmSans leading-relaxed">
    {children}
  </div>
);

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy" lastUpdated="July 2025">

      <Info>
        This Privacy Policy explains how Tycoon (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;)
        collects, uses, and protects your information when you use our website, game, or services
        (the &quot;Services&quot;). By using our Services you agree to the practices described here.
      </Info>

      <section className="space-y-3">
        <S>1. Information We Collect</S>

        <p className="font-semibold text-[#F0F7F7]">a. Blockchain &amp; Wallet Data (Public &amp; On-Chain)</p>
        <p>When you connect a wallet:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your public wallet address</li>
          <li>On-chain transactions, token balances, NFT holdings, and interactions (all visible on the blockchain)</li>
        </ul>
        <Info>
          <strong>Important:</strong> Blockchain data is public, permanent, and immutable. We
          cannot delete or hide any information recorded on the ledger.
        </Info>

        <p className="font-semibold text-[#F0F7F7]">b. Account &amp; Sign-in Data</p>
        <p>If you sign in with email or social login (via our third-party authentication provider):</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email address or other login identifier</li>
          <li>Authentication tokens and session data</li>
        </ul>

        <p className="font-semibold text-[#F0F7F7]">c. Game &amp; Usage Data (Telemetry)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gameplay activity, progress, and interactions</li>
          <li>Device information (type, OS, browser version)</li>
          <li>IP address (for security, fraud prevention, and region detection)</li>
          <li>Error logs, crash reports, and performance metrics</li>
          <li>Cookies or similar technologies (for functionality and analytics) — see our <a href="/cookies" className="text-[#00F0FF] hover:underline">Cookies Policy</a></li>
        </ul>

        <p className="font-semibold text-[#F0F7F7]">d. Other Information</p>
        <p>Any data you voluntarily provide when contacting support or giving feedback.</p>
      </section>

      <section className="space-y-3">
        <S>2. How We Use Your Information</S>
        <p>We use the data to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Operate and improve the Tycoon game</li>
          <li>Enable wallet connectivity and blockchain features</li>
          <li>Provide account security and session management</li>
          <li>Analyse gameplay trends and fix bugs</li>
          <li>Prevent fraud and abuse</li>
          <li>Respond to your support requests</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>3. Legal Basis &amp; Consent</S>
        <p>We process your data based on:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Your consent</strong> — by connecting a wallet, signing in, or continuing to play</li>
          <li><strong>Performance of contract</strong> — to deliver the game and its features to you</li>
          <li><strong>Legitimate interests</strong> — security, service improvement, and fraud prevention</li>
          <li><strong>Legal obligation</strong> — to comply with applicable laws</li>
        </ul>
        <p>
          You can withdraw consent at any time by stopping use of the Services. This does not
          affect already-public blockchain data, which is immutable.
        </p>
      </section>

      <section className="space-y-3">
        <S>4. Sharing Your Information</S>
        <p>We share data only when necessary:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Trusted service providers</strong> — authentication (Privy), analytics,
            hosting, crash reporting (Sentry), and payments (Flutterwave) — all bound by data
            protection agreements
          </li>
          <li><strong>Legal requirement</strong> — when required by law or government request</li>
          <li>
            <strong>Business transfer</strong> — in the event of a merger or acquisition, with
            notice where required by law
          </li>
        </ul>
        <p>
          <strong>We never sell your personal data for marketing.</strong> On-chain activity
          remains publicly visible to anyone on the blockchain.
        </p>
      </section>

      <section className="space-y-3">
        <S>5. International Data Transfers</S>
        <p>
          Tycoon is a global service. Your data may be transferred and processed outside your
          country — including to servers in the United States, Europe, Nigeria, or other locations.
          We use appropriate safeguards (such as Standard Contractual Clauses where required) to
          protect your data during these transfers in compliance with GDPR, NDPA 2023, and other
          applicable frameworks.
        </p>
      </section>

      <section className="space-y-3">
        <S>6. Data Retention</S>
        <p>
          We keep non-public personal data only as long as necessary to provide the Services or as
          required by law:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account data — while active and up to 2 years after deletion</li>
          <li>Transaction records — up to 7 years for legal/tax compliance</li>
          <li>Error logs — up to 90 days</li>
        </ul>
        <p>
          You may request deletion of personal data we control by contacting support. Blockchain
          data cannot be deleted.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Your Rights</S>
        <p>
          Depending on where you live (EU/EEA, UK, Nigeria, California, or elsewhere), you may
          have rights to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access, correct, or delete your personal data (where technically possible)</li>
          <li>Object to or restrict processing</li>
          <li>Data portability — receive your data in a structured format</li>
          <li>Withdraw consent at any time</li>
          <li>Opt out of the sale of personal data (we do not sell data)</li>
          <li>Lodge a complaint with your local data protection authority</li>
        </ul>
        <p>
          To exercise any right, contact us at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>. We will respond within 30 days.
        </p>
      </section>

      <section className="space-y-3">
        <S>8. Cookies &amp; Tracking</S>
        <p>
          We use cookies and similar technologies for authentication, preferences, and analytics.
          For full details including a cookie table and your opt-out options, see our{' '}
          <a href="/cookies" className="text-[#00F0FF] hover:underline">Cookies Policy</a>.
        </p>
        <p>
          <strong>Do Not Sell / Do Not Share:</strong> We do not sell or share personal data with
          third parties for cross-context behavioural advertising.
        </p>
      </section>

      <section className="space-y-3">
        <S>9. Security</S>
        <p>
          We use reasonable technical and organisational measures (TLS encryption, access controls,
          regular security reviews) to protect your data. However, no system is 100% secure.
          Public blockchain data is outside our control. You are responsible for securing your
          wallet keys and login credentials.
        </p>
        <p>
          In the event of a data breach posing risk to your rights, we will notify affected users
          and relevant authorities as required by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <S>10. Children&apos;s Privacy</S>
        <p>
          Our Services are strictly for users aged 18 and over (see our{' '}
          <a href="/terms" className="text-[#00F0FF] hover:underline">Terms of Service</a>).
          We do not knowingly collect personal data from anyone under 18. If you believe a minor
          has registered, contact us immediately at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>{' '}
          and we will delete the data promptly.
        </p>
      </section>

      <section className="space-y-3">
        <S>11. Changes to This Policy</S>
        <p>
          We may update this Privacy Policy. Material changes will be posted with a new
          &quot;Last updated&quot; date. Continued use of the Services after changes constitutes
          acceptance of the updated policy.
        </p>
      </section>

      <section className="space-y-3">
        <S>12. Contact &amp; Supervisory Authorities</S>
        <p>
          For questions, data requests, or complaints:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>
          {' '}or our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">
            Telegram community
          </a>.
        </p>
        <p>
          If you are in the EU/EEA you may contact your national Data Protection Authority. If you
          are in Nigeria you may contact the Nigeria Data Protection Commission (NDPC). If you are
          in California you may exercise CCPA/CPRA rights via the contact above.
        </p>
      </section>

    </LegalDocLayout>
  );
}
