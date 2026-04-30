import LegalDocLayout from '@/components/legal/LegalDocLayout';

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms of Service">
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">1. The service</h2>
        <p>
          <strong>Tycoon</strong> is an on-chain game experience (including multiplayer rooms, AI
          modes, tournaments, and related features). The app may change as we ship improvements.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">2. Eligibility &amp; wallet</h2>
        <p>
          You are responsible for complying with laws where you live. Blockchain transactions are
          irreversible. You control your wallet; we do not custody your keys.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">3. Gameplay &amp; stakes</h2>
        <p>
          Where the game uses tokens (for example USDC stakes), you accept smart-contract rules on
          the network shown in the app. Fees, slippage, and network conditions are outside our
          control.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">4. Acceptable use</h2>
        <p>
          No cheating, abuse of APIs, harassment, or attempts to harm the service or other players.
          We may suspend access that violates these expectations.
        </p>
      </section>
      <section className="space-y-3">
        <h2 className="font-orbitron text-lg text-[#00F0FF]">5. Disclaimers</h2>
        <p>
          The service is provided <strong>as is</strong>. To the maximum extent permitted by law,
          we disclaim warranties. See counsel for liability caps and dispute resolution in your
          jurisdiction.
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
