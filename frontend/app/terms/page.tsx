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

      <section className="space-y-3">
        <S>1. Acceptance of Terms</S>
        <p>
          By accessing or using Tycoon (&quot;the Service&quot;, &quot;the Platform&quot;,
          &quot;we&quot;, &quot;us&quot;), operated by Sabo Ajidokwu Emmanuel, you agree to be
          bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the
          Service. These Terms apply to all users including registered players, guests, and visitors.
        </p>
        <p>
          We may update these Terms at any time. Continued use after changes constitutes acceptance.
          Material changes will be communicated via the platform or email where possible.
        </p>
      </section>

      <section className="space-y-3">
        <S>2. Description of Service</S>
        <p>
          Tycoon is an on-chain strategy board game inspired by classic property-trading games,
          deployed on Celo and Base blockchains. Features include: multiplayer rooms (PvP), AI
          opponents, tournaments, in-game shop, collectibles, perks, and a reward system.
        </p>
        <p>
          The Service is provided &quot;as is&quot; and may be modified, suspended, or discontinued
          at any time without prior notice. We are not liable for any loss resulting from such
          changes.
        </p>
      </section>

      <section className="space-y-3">
        <S>3. Eligibility</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>You must be 18 years of age or older.</li>
          <li>You must have legal capacity to enter into binding agreements.</li>
          <li>
            You must not be located in a jurisdiction where use of blockchain applications,
            token transactions, or this type of game is prohibited.
          </li>
          <li>You must not be on any government sanctions list.</li>
          <li>
            You are solely responsible for determining whether use of the Service is lawful in
            your jurisdiction.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>4. Not a Gambling Platform — Important Disclaimer</S>
        <Info>
          Tycoon is a <strong>skill-based competitive strategy game</strong>. Entry stakes (where
          applicable) are participation fees that fund the prize pool for the winner of that game
          session — similar to a tournament entry fee. Outcomes are determined by player decisions,
          strategy, and game mechanics, not by chance alone. Tycoon does not operate as a casino,
          bookmaker, or gambling operator. We do not offer odds, house edges, or random-outcome
          wagering. TYC tokens and USDC used in-game are game utility instruments, not financial
          instruments or securities.
        </Info>
        <p>
          Notwithstanding the above, you are solely responsible for understanding and complying with
          the laws of your jurisdiction regarding online games, token transactions, and prize
          competitions. We make no representation that the Service is legal in your location.
        </p>
      </section>

      <section className="space-y-3">
        <S>5. Wallet, Blockchain & Financial Responsibility</S>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            You are solely responsible for the security of your wallet, private keys, and seed
            phrases. We do not custody your keys and cannot recover lost wallets.
          </li>
          <li>
            All blockchain transactions are irreversible. Verify all transaction details before
            confirming. We are not liable for transactions sent to wrong addresses or lost due to
            user error.
          </li>
          <li>
            Network fees (gas), slippage, and blockchain congestion are outside our control. You
            accept these risks when transacting on-chain.
          </li>
          <li>
            Smart contract interactions carry inherent risks including bugs, exploits, and network
            failures. We conduct reasonable testing but cannot guarantee contract security.
          </li>
          <li>
            Token values (TYC, USDC) may fluctuate. We make no representations about token value
            or investment returns.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <S>6. In-Game Purchases & Virtual Items</S>
        <p>
          Purchases of perks, collectibles, bundles, and credits are final and non-refundable
          unless required by applicable consumer protection law. Virtual items have no real-world
          monetary value outside the game and cannot be exchanged for fiat currency through us.
        </p>
        <p>
          We reserve the right to modify, rebalance, or remove virtual items at any time. We are
          not liable for any loss of virtual items resulting from account termination, game changes,
          or service discontinuation.
        </p>
      </section>

      <section className="space-y-3">
        <S>7. Acceptable Use Policy</S>
        <p>You agree NOT to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cheat, exploit bugs, use bots, scripts, or automation not provided by us.</li>
          <li>Harass, abuse, threaten, or harm other players.</li>
          <li>Attempt to reverse-engineer, decompile, or tamper with smart contracts or the platform.</li>
          <li>Use the Service for money laundering, fraud, or any illegal activity.</li>
          <li>Create multiple accounts to circumvent bans or gain unfair advantages.</li>
          <li>Impersonate other players, staff, or entities.</li>
          <li>Transmit malware, spam, or disruptive content.</li>
          <li>Attempt to manipulate game outcomes through collusion.</li>
        </ul>
        <p>
          Violations may result in immediate account suspension, forfeiture of in-game assets, and
          reporting to relevant authorities where required by law.
        </p>
      </section>

      <section className="space-y-3">
        <S>8. Advertising Policy</S>
        <p>
          The Service may display third-party advertisements or promotional content. We are not
          responsible for the content, accuracy, or practices of third-party advertisers. Clicking
          on ads is at your own risk. We do not endorse advertised products or services.
        </p>
        <p>
          We do not serve targeted advertising based on sensitive personal data. Any advertising
          displayed complies with applicable advertising standards including the IAB guidelines and
          relevant consumer protection regulations.
        </p>
        <p>
          We will never display gambling advertisements, adult content, or misleading financial
          promotions on the platform.
        </p>
      </section>

      <section className="space-y-3">
        <S>9. Intellectual Property</S>
        <p>
          All platform content including game design, artwork, code, branding, and documentation is
          owned by or licensed to Tycoon. You may not reproduce, distribute, or create derivative
          works without written permission.
        </p>
        <p>
          By submitting content (e.g. usernames, profile data), you grant us a non-exclusive,
          royalty-free licence to use that content in connection with operating the Service.
        </p>
      </section>

      <section className="space-y-3">
        <S>10. Disclaimer of Warranties</S>
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES
          OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES.
        </p>
      </section>

      <section className="space-y-3">
        <S>11. Limitation of Liability</S>
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, TYCOON AND ITS OPERATORS SHALL NOT BE
          LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF OR INABILITY TO
          USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </p>
        <p>
          OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM THESE TERMS OR THE SERVICE SHALL
          NOT EXCEED THE AMOUNT YOU PAID TO US IN THE 30 DAYS PRECEDING THE CLAIM.
        </p>
      </section>

      <section className="space-y-3">
        <S>12. User Responsibility Disclaimer</S>
        <p>
          You use the Service entirely at your own risk. You are solely responsible for:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>All actions taken with your account and wallet.</li>
          <li>Compliance with laws in your jurisdiction.</li>
          <li>Any financial decisions made in connection with the game.</li>
          <li>Safeguarding your login credentials and wallet keys.</li>
          <li>Any tax obligations arising from token transactions or prizes.</li>
        </ul>
        <p>
          We are not financial advisors. Nothing on this platform constitutes financial, investment,
          legal, or tax advice.
        </p>
      </section>

      <section className="space-y-3">
        <S>13. Responsible Gaming</S>
        <p>
          While Tycoon is not a gambling platform, we encourage responsible engagement. If you feel
          you are spending excessive time or money on the platform, please take a break. We support
          self-exclusion requests — contact us at{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>{' '}
          to request account suspension.
        </p>
      </section>

      <section className="space-y-3">
        <S>14. Termination</S>
        <p>
          We may suspend or terminate your access at any time for violation of these Terms or for
          any other reason at our discretion. You may stop using the Service at any time. On
          termination, your right to use the Service ceases immediately. Provisions that by their
          nature should survive termination will do so.
        </p>
      </section>

      <section className="space-y-3">
        <S>15. Governing Law & Disputes</S>
        <p>
          These Terms are governed by applicable law. Any disputes shall first be attempted to be
          resolved through good-faith negotiation. If unresolved, disputes shall be submitted to
          binding arbitration or the courts of competent jurisdiction. You waive any right to
          participate in class-action proceedings to the extent permitted by law.
        </p>
      </section>

      <section className="space-y-3">
        <S>16. Changes to Terms</S>
        <p>
          We reserve the right to modify these Terms at any time. We will post the updated Terms
          with a new &quot;Last updated&quot; date. Your continued use of the Service after changes
          constitutes acceptance of the revised Terms.
        </p>
      </section>

      <section className="space-y-3">
        <S>17. Contact</S>
        <p>
          For legal notices, support, or questions about these Terms, contact:{' '}
          <a href="mailto:support@tycoonworld.xyz" className="text-[#00F0FF] hover:underline">
            support@tycoonworld.xyz
          </a>
          {' '}or via our{' '}
          <a href="https://t.me/+xJLEjw9tbyQwMGVk" className="text-[#00F0FF] hover:underline">
            Telegram community
          </a>.
        </p>
      </section>

    </LegalDocLayout>
  );
}
