import LegalDocLayout from '@/components/legal/LegalDocLayout';

const S = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-orbitron text-base text-[#00F0FF] mt-2">{children}</h2>
);

const Warning = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-red-500/40 bg-red-950/25 rounded-xl p-4 text-red-200 text-sm font-dmSans leading-relaxed">
    {children}
  </div>
);

const Info = ({ children }: { children: React.ReactNode }) => (
  <div className="border border-[#00F0FF]/25 bg-[#00F0FF]/5 rounded-xl p-4 text-[#C8F0F2] text-sm font-dmSans leading-relaxed">
    {children}
  </div>
);

export default function TermsPage() {
  return (
    <LegalDocLayout title="Terms of Service" lastUpdated="July 2025">

      <Warning>
        <strong>⚠️ NOT A GAMBLING PLATFORM.</strong> Tycoon is a skill-based strategy game. Entry
        stakes are game participation fees — not bets or wagers. No element of the game constitutes
        gambling under any applicable definition. If you are in a jurisdiction where blockchain-based
        games or token transactions are restricted, you must not use this service.
      </Warning>

      <Warning>
        <strong>🔞 AGE RESTRICTION — 18+ ONLY.</strong> You must be at least 18 years old (or the
        age of majority in your jurisdiction, whichever is higher) to use Tycoon. By accessing or
        using the service you confirm you meet this requirement. We reserve the right to terminate
        accounts where age requirements are not met.
      </Warning>

      <Info>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Tycoon,
        including our website, game, multiplayer rooms, AI modes, tournaments, and all related
        features (collectively the &quot;Services&quot;). By accessing or using Tycoon, you agree
        to be bound by these Terms. If you do not agree, you must not use the Services.
      </Info>

      <section className="space-y-3">
        <S>1. The Services</S>
        <p>
          Tycoon is an on-chain blockchain game that includes gameplay, multiplayer rooms, AI modes,
          tournaments, token interactions, and other features. We may update, modify, or add new
          features at any time without prior notice. We are not liable for any loss resulting from
          such changes.
        </p>
      </section>

      <section className="space-y-3">
        <S>2. Eligibility</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be at least 18 years old (or the age of majority in your jurisdiction, whichever is higher).</li>
          <li>You must have the legal capacity to enter into these Terms.</li>
          <li>You must not be located in a jurisdiction where use of blockchain applications or token transactions is prohibited.</li>
          <li>You must not be on any government sanctions list.</li>
          <li>You are solely responsible for ensuring your use of the Services complies with all laws and regulations in your jurisdiction.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>3. Wallets &amp; Blockchain</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must connect a compatible cryptocurrency wallet to use certain features.</li>
          <li>We do not custody your private keys, seed phrases, or funds. You are fully responsible for the security of your wallet.</li>
          <li>All blockchain transactions are irreversible. We are not responsible for lost funds due to user error, network issues, or smart-contract behaviour.</li>
          <li>By interacting with any smart contracts shown in the app, you accept the rules and risks of those contracts.</li>
          <li>Network fees (gas), slippage, and blockchain congestion are outside our control.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>4. Not a Gambling Platform</S>
        <Info>
          Tycoon is a <strong>skill-based competitive strategy game</strong>. Entry stakes (where
          applicable) are participation fees that fund the prize pool for the winner of that game
          session — similar to a tournament entry fee. Outcomes are determined by player decisions,
          strategy, and game mechanics. Tycoon does not operate as a casino, bookmaker, or gambling
          operator. TYC tokens and USDC used in-game are game utility instruments, not financial
          instruments or securities.
        </Info>
        <p>
          You are solely responsible for understanding and complying with the laws of your
          jurisdiction regarding online games, token transactions, and prize competitions.
        </p>
      </section>

      <section className="space-y-3">
        <S>5. Gameplay, Stakes &amp; In-Game Assets</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>In-game assets and tokens have no guaranteed value and may fluctuate or become worthless.</li>
          <li>We do not guarantee any financial return or outcome from playing or staking.</li>
          <li>Purchases of perks, collectibles, bundles, and credits are final and non-refundable unless required by applicable consumer protection law.</li>
          <li>We reserve the right to modify, rebalance, or remove virtual items at any time.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>6. Acceptable Use &amp; Prohibited Conduct</S>
        <p>You agree not to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cheat, hack, exploit bugs, or use unauthorised automation or scripts</li>
          <li>Harass, threaten, or abuse other players</li>
          <li>Attempt to interfere with the Services or other users&apos; experience</li>
          <li>Use the Services for any illegal or unauthorised purpose including money laundering or fraud</li>
          <li>Impersonate others or provide false information</li>
          <li>Create multiple accounts to circumvent bans or gain unfair advantages</li>
          <li>Attempt to reverse-engineer or tamper with smart contracts or the platform</li>
        </ul>
        <p>
          We may suspend or terminate your access immediately if we believe you have violated these
          rules. Serious violations may be reported to relevant authorities.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Advertising Policy</S>
        <p>
          The Service may display third-party advertisements. We are not responsible for the
          content or practices of third-party advertisers. We do not serve targeted advertising
          based on sensitive personal data and will never display gambling advertisements, adult
          content, or misleading financial promotions.
        </p>
      </section>

      <section className="space-y-3">
        <S>8. Intellectual Property</S>
        <p>
          All game content, logos, artwork, and software (excluding your on-chain assets) are owned
          by Tycoon or its licensors. You are granted a limited, personal, non-exclusive licence to
          use the Services for personal entertainment only. You may not copy, modify, or distribute
          our content without written permission.
        </p>
      </section>

      <section className="space-y-3">
        <S>9. Termination</S>
        <p>
          We may suspend or terminate your access to the Services at any time, with or without
          notice, for any reason including violation of these Terms. Upon termination, your right
          to use the Services ends immediately. Blockchain assets in your wallet remain yours.
        </p>
      </section>

      <section className="space-y-3">
        <S>10. Disclaimers &amp; Limitation of Liability</S>
        <p>
          THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT ANY
          WARRANTIES, EXPRESS OR IMPLIED. TO THE MAXIMUM EXTENT PERMITTED BY LAW, TYCOON AND ITS
          TEAM DISCLAIM ALL WARRANTIES AND SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOSS OF FUNDS, LOSS OF DATA, OR LOST
          PROFITS.
        </p>
        <p>
          Blockchain and cryptocurrency involve high risk — you use the Services entirely at your
          own risk. We are not financial advisors. Nothing on this platform constitutes financial,
          investment, legal, or tax advice.
        </p>
      </section>

      <section className="space-y-3">
        <S>11. User Responsibility &amp; Indemnification</S>
        <p>You are solely responsible for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All actions taken with your account and wallet</li>
          <li>Compliance with laws in your jurisdiction</li>
          <li>Any financial decisions made in connection with the game</li>
          <li>Any tax obligations arising from token transactions or prizes</li>
        </ul>
        <p>
          You agree to indemnify and hold Tycoon harmless from any claims, losses, or damages
          arising from your use of the Services, your violation of these Terms, or your breach of
          any applicable law.
        </p>
      </section>

      <section className="space-y-3">
        <S>12. Responsible Gaming</S>
        <p>
          While Tycoon is not a gambling platform, we encourage responsible engagement. If you feel
          you are spending excessive time or money on the platform, please take a break. Contact us
          at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>{' '}
          to request a self-exclusion or account suspension.
        </p>
      </section>

      <section className="space-y-3">
        <S>13. Changes to These Terms</S>
        <p>
          We may update these Terms from time to time. We will post the new version with an updated
          &quot;Last updated&quot; date. Continued use of the Services after changes means you
          accept the updated Terms.
        </p>
      </section>

      <section className="space-y-3">
        <S>14. Governing Law &amp; Dispute Resolution</S>
        <p>
          These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes
          shall first be resolved through good-faith negotiation. If not resolved within 30 days,
          disputes will be settled by arbitration in Nigeria or as otherwise required by applicable
          law. You waive any right to participate in class-action proceedings to the extent
          permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <S>15. Contact</S>
        <p>
          For questions or support regarding these Terms:{' '}
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
