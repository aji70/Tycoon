# Tycoon — Implementation Checklist

Use this checklist to pick what to implement next. Say the **number or title** (e.g. “do 3” or “implement Specific game stats”) and we’ll do it one at a time.

---

## 1. Features (product)

| # | Item | Notes |
|---|------|--------|
| 1.1 | **Specific game stats** ✅ | Replace “Specific game stats feature coming soon!” with real query (e.g. by game code/ID) and display. |
| 1.2 | **Multiplayer lobbies (browse)** ✅ | Beyond join-by-code: list open/public games, join from list (backend + frontend). |
| 1.3 | **Leaderboards** ✅ | Full leaderboard: wins, games played, win rate; wire to real data and protect/optimize. |
| 1.4 | **Tournaments (brackets)** ✅ | Complete tournament flow: brackets, rounds, matchmaking, payouts (if staked). |
| 1.5 | **AI trade proposals** ✅ | Use decision engine to propose trades; call `POST /game-trade-requests` from AI flow. |
| 1.6 | **Perk / collectible copy** ✅ | Replace “Coming soon” in collectibles/shop with real perk descriptions and shop copy. |
| 1.7 | **Rooms on mobile (fix)** | Fix client error on `/rooms` on mobile and re-add Rooms to mobile nav (or keep removed if intentional). |
| 1.8 | **Onboarding / tutorial** ✅ | First-time flow: short tutorial or guided steps (e.g. connect wallet → create or join game). |
| 1.9 | **Error recovery UX** ✅ | Clearer messages and flows for disconnect, failed roll, timeout, rejoin. |

---

## 2. Analytics & dashboards

| # | Item | Notes |
|---|------|--------|
| 2.1 | **More analytics events** ✅ | Emit `game_started`, `game_finished`, `game_joined`, optional `error` (code/message) via `recordEvent()`. |
| 2.2 | **Dashboard: games over time** ✅ | On `/analytics`: e.g. “Games started vs finished”, “Games over last 7 days”. |
| 2.3 | **Dashboard protection** ✅ | Restrict `GET /api/analytics/*` and `/analytics` (admin-only or API key) before production. |
| 2.4 | **Dashboard: filters & export** ✅ | Date range filter, optional CSV export or “recent activity” / errors tab. |

---

## 3. Backend & data

| # | Item | Notes |
|---|------|--------|
| 3.1 | **Guest account merge** ✅ | Merge guest into wallet: `POST /auth/merge-guest-into-wallet`; “merge guest into existing wallet account” frontend in AccountLinkWallet. DB state (games, stats, votes) is transferred; guest’s on-chain winnings (vouchers) remain in custodial wallet unless a separate transfer flow is added. |
| 3.1b | **Wallet & email reconciliation** ✅ | Same profile for wallet or email login: user table has `email`; connect-email in profile; Privy sign-in syncs existing email users (findByEmail → link privy_did). Guest/wallet users are prompted to link email so login-by-wallet and login-email resolve to the same profile. |
| 3.2 | **Auction edge cases** ✅ | See `doc/auction-edge-cases.md`: timeout, reconnection, ties. |
| 3.3 | **N+1 / query optimization** ✅ | Batch load: `GameSetting.findByGameIds`, `GamePlayer.findByGameIds`; see `doc/data-optimization.md`. |

---

## 4. Infrastructure & quality

| # | Item | Notes |
|---|------|--------|
| 4.1 | **Load testing** ✅ | k6 script in `scripts/load/load-test.js` (~200 VUs, 2m); see `doc/load-testing.md`. |
| 4.2 | **Monitoring (Sentry/APM)** ✅ | Sentry in backend (`@sentry/node`) and frontend (`@sentry/nextjs`); see `doc/monitoring-sentry.md`. |
| 4.3 | **Security audit prep** ✅ | Checklist/doc in `doc/security-audit-prep.md`: auth, stakes, contract calls, rate limits, contract-specific. |

---

## 5. Future / roadmap (not immediate)

| # | Item | Notes |
|---|------|--------|
| 5.1 | **Yield / farming** | Yield farming integrations (from README). |
| 5.2 | **DAO governance** | DAO governance for expansions (from README). |
| 5.3 | **i18n / accessibility** | Localization and a11y pass if/when needed. |

---

## How to use

- **Pick one:** e.g. “Implement 1.1” or “Do Specific game stats”.
- We implement that item only, then you can pick the next from this list.
- When done, you can add a `[x]` or “Done” note next to the item in this file.

---

*Last updated: March 2026*
