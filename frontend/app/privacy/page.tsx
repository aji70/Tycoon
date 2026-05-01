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
        This Privacy Policy explains how Tycoon (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;)
        collects, uses, stores, and protects your personal data when you use our platform at{' '}
        <a href="https://tycoonworld.xyz" className="text-[#00F0FF] hover:underline">tycoonworld.xyz</a>.
        We are committed to protecting your privacy and complying with applicable data protection
        laws including the EU General Data Protection Regulation (GDPR), UK GDPR, and other
        applicable privacy regulations.
      </Info>

      <section className="space-y-3">
        <S>1. Data Controller</S>
        <p>
          The data controller for personal data processed through this Service is:
          <br /><strong>Sabo Ajidokwu Emmanuel</strong> — operating as Tycoon.
          <br />Contact:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>
        </p>
      </section>

      <section className="space-y-3">
        <S>2. Data We Collect</S>
        <p><strong>2.1 Data you provide directly:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Email address (if you register with email/social login via Privy)</li>
          <li>Username or display name</li>
          <li>Profile information you choose to add</li>
          <li>Communications you send us (support requests, feedback)</li>
        </ul>
        <p><strong>2.2 Data collected automatically:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Wallet address (public blockchain address — publicly visible on-chain)</li>
          <li>IP address and approximate geolocation (country/region level)</li>
          <li>Device type, browser, and operating system</li>
          <li>Pages visited, features used, and session duration</li>
          <li>Game activity: moves, purchases, outcomes, timestamps</li>
          <li>Error logs and crash reports (via Sentry, if configured)</li>
        </ul>
        <p><strong>2.3 Blockchain data:</strong></p>
        <p>
          On-chain transactions (wallet address, transaction hashes, token transfers) are recorded
          on public blockchains (Celo, Base). This data is permanently public and cannot be deleted
          by us or by you. We have no control over public ledger data.
        </p>
        <p><strong>2.4 Payment data:</strong></p>
        <p>
          We do not store payment card details. USDC and TYC transactions occur on-chain. NGN
          payments via Flutterwave are processed by Flutterwave under their privacy policy. We
          receive only transaction confirmation and amount.
        </p>
      </section>

      <section className="space-y-3">
        <S>3. Legal Basis for Processing (GDPR)</S>
        <p>We process your personal data on the following legal bases:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Contract performance</strong> — to provide the game service, process
            transactions, and manage your account.
          </li>
          <li>
            <strong>Legitimate interests</strong> — to improve the platform, prevent fraud, ensure
            security, and conduct analytics.
          </li>
          <li>
            <strong>Legal obligation</strong> — to comply with applicable laws including anti-money
            laundering and sanctions screening.
          </li>
          <li>
            <strong>Consent</strong> — for optional cookies, marketing communications, and
            analytics where consent is required. You may withdraw consent at any time.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>4. How We Use Your Data</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>To create and manage your account and game sessions</li>
          <li>To process in-game transactions and distribute prizes</li>
          <li>To provide customer support</li>
          <li>To detect and prevent fraud, cheating, and abuse</li>
          <li>To improve game performance and user experience</li>
          <li>To send service-related notifications (not marketing without consent)</li>
          <li>To comply with legal obligations</li>
          <li>To enforce our Terms of Service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>5. Cookies & Tracking Technologies</S>
        <p>
          We use cookies and similar technologies. For full details see our{' '}
          <a href="/cookies" className="text-[#00F0FF] hover:underline">Cookies Policy</a>.
          In summary:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Strictly necessary cookies</strong> — required for the platform to function
            (authentication sessions, wallet state). Cannot be disabled.
          </li>
          <li>
            <strong>Analytics cookies</strong> — help us understand how users interact with the
            platform (e.g. page views, feature usage). Require your consent.
          </li>
          <li>
            <strong>Preference cookies</strong> — remember your settings (theme, language).
            Require your consent.
          </li>
        </ul>
        <p>
          You can manage cookie preferences via your browser settings or our cookie consent banner.
          Blocking strictly necessary cookies may prevent the Service from functioning.
        </p>
      </section>

      <section className="space-y-3">
        <S>6. Advertising & Third-Party Services</S>
        <p>
          We may display third-party advertisements. Advertisers may use cookies or tracking pixels
          subject to their own privacy policies. We do not share your personal data with advertisers
          without your consent.
        </p>
        <p>Third-party services we may use include:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Privy</strong> — authentication and embedded wallets (privy.io privacy policy)</li>
          <li><strong>WalletConnect / Reown</strong> — wallet connection protocol</li>
          <li><strong>Sentry</strong> — error tracking and crash reporting</li>
          <li><strong>Flutterwave</strong> — NGN payment processing</li>
          <li><strong>Celo / Base RPC providers</strong> — blockchain interaction</li>
        </ul>
        <p>
          Each third party processes data under their own privacy policy. We encourage you to
          review those policies.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Data Sharing & Disclosure</S>
        <p>We do not sell your personal data. We may share data with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Service providers</strong> — who process data on our behalf under data
            processing agreements (hosting, analytics, error tracking, payments).
          </li>
          <li>
            <strong>Law enforcement / regulators</strong> — when required by law, court order, or
            to protect rights and safety.
          </li>
          <li>
            <strong>Business transfers</strong> — in the event of a merger, acquisition, or asset
            sale, your data may be transferred. We will notify you of any such change.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>8. International Data Transfers</S>
        <p>
          Your data may be processed in countries outside your own, including countries that may
          not have equivalent data protection laws. Where we transfer data outside the EEA/UK, we
          ensure appropriate safeguards are in place (e.g. Standard Contractual Clauses, adequacy
          decisions). Contact us for details of transfer mechanisms.
        </p>
      </section>

      <section className="space-y-3">
        <S>9. Data Retention</S>
        <p>
          We retain personal data for as long as necessary to provide the Service and comply with
          legal obligations:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Account data — retained while your account is active and for up to 2 years after deletion</li>
          <li>Transaction records — retained for up to 7 years for legal/tax compliance</li>
          <li>Error logs — retained for up to 90 days</li>
          <li>Marketing data — until you withdraw consent</li>
        </ul>
        <p>
          On-chain data (wallet addresses, transaction hashes) is permanently recorded on public
          blockchains and cannot be deleted.
        </p>
      </section>

      <section className="space-y-3">
        <S>10. Your Rights (GDPR & Applicable Law)</S>
        <p>
          Depending on your jurisdiction, you may have the following rights regarding your personal
          data:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Right of access</strong> — request a copy of your personal data</li>
          <li><strong>Right to rectification</strong> — correct inaccurate data</li>
          <li><strong>Right to erasure</strong> — request deletion (&quot;right to be forgotten&quot;) where applicable</li>
          <li><strong>Right to restriction</strong> — limit how we process your data</li>
          <li><strong>Right to data portability</strong> — receive your data in a structured format</li>
          <li><strong>Right to object</strong> — object to processing based on legitimate interests</li>
          <li><strong>Right to withdraw consent</strong> — at any time for consent-based processing</li>
          <li><strong>Right to lodge a complaint</strong> — with your local data protection authority</li>
        </ul>
        <p>
          To exercise any right, contact us at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>. We will respond within 30 days. Note: we cannot delete on-chain data.
        </p>
      </section>

      <section className="space-y-3">
        <S>11. Children's Privacy</S>
        <p>
          The Service is strictly for users aged 18 and over. We do not knowingly collect personal
          data from anyone under 18. If we become aware that a minor has provided personal data, we
          will delete it promptly. If you believe a minor has registered, contact us immediately at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>.
        </p>
      </section>

      <section className="space-y-3">
        <S>12. Data Security</S>
        <p>
          We implement industry-standard technical and organisational measures to protect your
          personal data including encryption in transit (TLS), access controls, and regular security
          reviews. However, no system is completely secure. You are responsible for keeping your
          wallet keys and login credentials safe.
        </p>
        <p>
          In the event of a data breach that poses a risk to your rights and freedoms, we will
          notify affected users and relevant authorities as required by applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <S>13. Changes to This Policy</S>
        <p>
          We may update this Privacy Policy from time to time. We will post the updated policy with
          a new &quot;Last updated&quot; date. For material changes, we will provide notice via the
          platform or email. Continued use after changes constitutes acceptance.
        </p>
      </section>

      <section className="space-y-3">
        <S>14. Contact & Supervisory Authority</S>
        <p>
          For privacy-related questions or to exercise your rights, contact:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>.
        </p>
        <p>
          If you are in the EU/EEA and believe we have not handled your data lawfully, you have the
          right to lodge a complaint with your local supervisory authority (e.g. your national Data
          Protection Authority).
        </p>
      </section>

    </LegalDocLayout>
  );
}
