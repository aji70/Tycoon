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
| 1.5 | **AI trade proposals** | Use decision engine to propose trades; call `POST /game-trade-requests` from AI flow. |
| 1.6 | **Perk / collectible copy** | Replace “Coming soon” in collectibles/shop with real perk descriptions and shop copy. |
| 1.7 | **Rooms on mobile (fix)** | Fix client error on `/rooms` on mobile and re-add Rooms to mobile nav (or keep removed if intentional). |
| 1.8 | **Onboarding / tutorial** | First-time flow: short tutorial or guided steps (e.g. connect wallet → create or join game). |
| 1.9 | **Error recovery UX** | Clearer messages and flows for disconnect, failed roll, timeout, rejoin. |

---

## 2. Analytics & dashboards

| # | Item | Notes |
|---|------|--------|
| 2.1 | **More analytics events** | Emit `game_started`, `game_finished`, `game_joined`, optional `error` (code/message) via `recordEvent()`. |
| 2.2 | **Dashboard: games over time** | On `/analytics`: e.g. “Games started vs finished”, “Games over last 7 days”. |
| 2.3 | **Dashboard protection** | Restrict `GET /api/analytics/*` and `/analytics` (admin-only or API key) before production. |
| 2.4 | **Dashboard: filters & export** | Date range filter, optional CSV export or “recent activity” / errors tab. |

---

## 3. Backend & data

| # | Item | Notes |
|---|------|--------|
| 3.1 | **Guest account merge** | If needed: merge two guest accounts or “merge guest into existing wallet account” flow (backend + frontend). |
| 3.2 | **Auction edge cases** | Review auction: timeout, reconnection during auction, ties; document or fix. |
| 3.3 | **N+1 / query optimization** | Fix N+1 queries (e.g. with joins); add optimistic locking where safe. |

---

## 4. Infrastructure & quality

| # | Item | Notes |
|---|------|--------|
| 4.1 | **Load testing** | e.g. k6 with ~200 VUs to confirm 200+ concurrent users. |
| 4.2 | **Monitoring (Sentry/APM)** | Add error tracking and optional APM for backend/frontend. |
| 4.3 | **Security audit prep** | Checklist or doc for mainnet (e.g. auth, stakes, contract calls, rate limits). |

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
