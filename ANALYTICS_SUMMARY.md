# Tycoon – Analysis Summary & Improvement Plan

**Date:** February 12, 2026  
**Purpose:** Answer scalability/concurrency/frontend questions, then execute improvements step by step and add analytics dashboards for user feedback.

**Current status (Feb 2026):** The analysis below described the *before* state. **Steps 1–10 have been implemented.** See **`LENA_CHECKLIST.md`** for what was done (pool, indexes, analytics backend + dashboard, Redis adapter, game-update events, rate limits, Redis cache, Pino logging, `/health`). Optional follow-ups: more events, N+1 fixes, load testing, dashboard protection.

---

## 1. Is it scalable for 100–200k DAUs?

**Original answer: not yet (~30% ready).** After implementing the plan:

| Area | Was | Now |
|------|-----|-----|
| **DB connection pool** | ❌ max 10 | ✅ Production: min 5, max 50 (knexfile). |
| **Database indexes** | ❌ Missing | ✅ Migration added for game_players, games, game_properties, game_play_history. |
| **Redis usage** | ⚠️ Properties only | ✅ Redis cache for game-by-code (60s TTL), invalidated on update. |
| **Frontend polling** | ❌ Heavy polling | ✅ Backend emits `game-update`; frontend subscribes and refetches on event (less polling). |
| **Rate limiting** | ✅ 300 req/min | ✅ Kept; plus per-IP socket limit (5) and per-socket event limit (60/min). |
| **Security** | ✅ | ✅ Unchanged (Helmet, CORS, JWT, Joi). |

---

## 2. What to consider when many people play at once (e.g. 200 concurrent)?

**Original answer: several things missing (~40% ready).** After implementing the plan:

| Consideration | Was | Now |
|----------------|-----|-----|
| **Socket.io scaling** | ❌ Single instance | ✅ Redis adapter; can run multiple app instances. |
| **DB lock contention** | ⚠️ | ⚠️ Unchanged (optional: optimistic locking later). |
| **Connection limits** | ❌ None | ✅ Per-IP limit (5), socket event rate limit (60/min). |
| **N+1 queries** | ⚠️ | ⚠️ Optional follow-up (joins). |

---

## 3. Is the frontend using industry-standard coding libraries?

**Short answer: yes.** Frontend is in good shape.

| Category | Libraries | Assessment |
|----------|-----------|------------|
| **Framework** | Next.js 14, React 18 | ✅ Standard. |
| **Data fetching** | @tanstack/react-query | ✅ Standard. |
| **Real-time** | socket.io-client | ✅ Standard. |
| **Styling** | Tailwind CSS 4 | ✅ Standard. |
| **UI primitives** | Radix UI (Select, Switch) | ✅ Accessible, standard. |
| **Animation** | Framer Motion | ✅ Standard. |
| **Web3** | Wagmi, Viem, @reown/appkit | ✅ Modern stack. |
| **Language** | TypeScript | ✅ Type safety. |

**Backend:** Express, Knex, MySQL2, Redis, Socket.io, Joi, Helmet, express-rate-limit are all standard. **Now also:** @socket.io/redis-adapter, Pino logging. Optional: API docs (e.g. Swagger).

---

## 4. Execution plan (step by step, with testing)

All steps below have been executed. See `LENA_CHECKLIST.md` for details.

| Step | What | Status |
|------|------|--------|
| **1** | Increase DB pool (knexfile) and add Redis `setex`/`del` for future caching | ✅ Done (prod pool max 50; Redis used in gameCache). |
| **2** | Add DB indexes (migration) for games, game_players, game_properties, game_play_history | ✅ Done. |
| **3** | Add analytics backend: events table + recordEvent + dashboard API | ✅ Done (`analytics_events`, `GET /api/analytics/dashboard`, `recordEvent('game_created')`). |
| **4** | Add analytics dashboard frontend (counts, simple charts) | ✅ Done (`/analytics` page). |
| **5** | Socket.io Redis adapter | ✅ Done (`config/socketRedis.js`, adapter attached when Redis available). |
| **6** | Replace polling with Socket.io events | ✅ Done (`game-update` emitted; frontend subscribes via `onGameUpdate`). |
| **7** | Connection limits and socket event rate limiting | ✅ Done (per-IP 5, 60 events/min per socket). |
| **8** | Redis cache for hot game lookup (findByCode) | ✅ Done (`utils/gameCache.js`, 60s TTL). |
| **9** | Structured logging (Pino) | ✅ Done (`config/logger.js`, used across server and controllers). |
| **10** | Health check (DB + Redis) | ✅ Done (`GET /health`, returns 503 when degraded). |

---

## 5. Analytics dashboards for user feedback

**Goal:** So you can see what users do and react to feedback (e.g. drop-off, errors, popular flows).

**Implemented:** We have the `analytics_events` table, `recordEvent('game_created')` on game create, `GET /api/analytics/dashboard`, and the `/analytics` dashboard page (cards for total games, by status, today/this week, event counts). Optional next: protect dashboard, more events (game_started, game_finished, etc.), drop-off view, filters, CSV.

1. **Backend (in place)**
   - **Events table:** Store anonymous or pseudonymous events: `game_created`, `game_joined`, `game_started`, `turn_taken`, `game_finished`, `error` (with message/code), etc.
   - **Dashboard API:** e.g. `GET /api/analytics/dashboard` returning:
     - Counts: games created/started/finished today and last 7 days
     - Active games / concurrent players (if we track them)
     - Top error codes or messages
     - Optional: simple retention (e.g. “games started vs finished”)
   - **Privacy:** No PII in analytics by default; only event types, counts, and optional non-identifying dimensions (e.g. device type if you add it later).

2. **Frontend**
   - **Dashboard page:** e.g. `/analytics` or `/admin/analytics` (protected by auth/role later):
     - Cards: total games, games today, active games, errors.
     - Simple charts (e.g. games over time, finishes vs abandons).
   - Use existing stack: React Query for data, Tailwind for layout; add a small chart library only if needed (e.g. Recharts or similar).

3. **Next steps (after MVP)**
   - Protect dashboard with admin role or API key.
   - Add more events (e.g. trade accepted, perk used).
   - Add filters (date range, game mode).
   - Optional: export CSV for deeper analysis.

---

## 6. Summary

- **100–200k DAUs:** Addressed with production pool (max 50), indexes, Redis caching for game-by-code, and Socket.io-driven updates (less polling). Optional: more caching, load testing.
- **200 concurrent players:** Addressed with Redis adapter for Socket.io, per-IP and per-socket rate limits, and Redis cache. Optional: N+1 fixes, optimistic locking, load testing.
- **Frontend standards:** Yes; stack is industry-standard (unchanged).
- **Done:** Steps 1–10 implemented step by step with testing. See `LENA_CHECKLIST.md` for the full list and optional follow-ups.
