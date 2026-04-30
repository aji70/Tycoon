import LegalDocLayout from '@/components/legal/LegalDocLayout';

export default function PrivacyPage() {
  return (
    <LegalDocLayout title="Privacy Policy">
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">1. Overview</h2>
        <p>
          This draft describes categories of data Tycoon may process. Replace with a
          jurisdiction-specific policy after legal review.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">2. Wallet &amp; on-chain data</h2>
        <p>
          When you connect a wallet, your public address and on-chain activity are visible on the
          blockchain. We cannot delete public ledger data.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">3. Account &amp; sign-in</h2>
        <p>
          If you use email or social sign-in (via our authentication provider), that provider
          processes credentials according to their policy. We use session tokens to keep you
          signed in to game features.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">4. Game &amp; product telemetry</h2>
        <p>
          We may log gameplay, errors, and performance data to run and improve the service. If we
          use analytics or crash reporting, those vendors process data under their terms.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">5. Retention</h2>
        <p>
          We retain operational logs as needed for security and support. Ask us via support
          channels for data questions until a formal process is published.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">6. Contact</h2>
        <p>
          Support:{' '}
          <a
            href="https://t.me/+xJLEjw9tbyQwMGVk"
            className="text-[#00F0FF] underline hover:text-[#0FF0FC]"
          >
            Telegram community
          </a>
          .
        </p>
      </section>
    </LegalDocLayout>
  );
}
