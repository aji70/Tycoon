# Tycoon – Analysis Summary & Improvement Plan

**Date:** February 12, 2026  
**Purpose:** Answer scalability/concurrency/frontend questions, then execute improvements step by step and add analytics dashboards for user feedback.

---

## 1. Is it scalable for 100–200k DAUs?

**Short answer: not yet.** Current readiness is about **30%** for that range.

| Area | Status | Notes |
|------|--------|------|
| **DB connection pool** | ❌ | `max: 10` in knexfile is too low; 100k DAUs imply ~1k+ concurrent requests. |
| **Database indexes** | ❌ | Missing indexes on `game_players(game_id)`, `game_players(user_id)`, `games(status)`, `game_properties(game_id)`, `game_play_history(game_id)`. Queries will do full table scans at scale. |
| **Redis usage** | ⚠️ | Redis is configured but only used for properties list. No caching of game state, sessions, or hot queries. |
| **Frontend polling** | ❌ | Multiple components poll every 3–15s. At 100k users this is 20k–33k requests/sec and unnecessary load. Should move to Socket.io-driven updates. |
| **Rate limiting** | ✅ | 300 req/min per IP is in place. |
| **Security** | ✅ | Helmet, CORS, JWT, validation (Joi) are present. |

**Planned improvements:** Increase pool size, add indexes, add Redis caching for hot data, replace polling with Socket.io where possible.

---

## 2. What to consider when many people play at once (e.g. 200 concurrent)?

**Short answer: several things are missing.** Current readiness for 200+ concurrent players is about **40%**.

| Consideration | Status | Notes |
|---------------|--------|------|
| **Socket.io scaling** | ❌ | Single server instance; no Redis adapter. Cannot run multiple app instances behind a load balancer and keep Socket.io rooms in sync. |
| **DB lock contention** | ⚠️ | Controllers use `forUpdate()` (pessimistic locks). At 200+ concurrent turns this can cause contention and deadlocks. Need optimistic locking and smaller transactions where possible. |
| **Connection limits** | ❌ | No per-IP or per-user Socket.io connection limits; no rate limiting on socket events. |
| **N+1 queries** | ⚠️ | Some paths load players then user data in loops; should use joins. |

**Planned improvements:** Add Socket.io Redis adapter, per-IP/event throttling, then optimize locking and queries.

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

**Backend:** Express, Knex, MySQL2, Redis, Socket.io, Joi, Helmet, express-rate-limit are all standard. Missing for scale: **@socket.io/redis-adapter**, structured logging (e.g. Pino), and optional API docs (e.g. Swagger).

---

## 4. Execution plan (step by step, with testing)

Improvements are applied in small steps so nothing breaks; each step is testable.

| Step | What | How to test |
|------|------|-------------|
| **1** | Increase DB pool (knexfile) and add Redis `setex`/`del` for future caching | Start backend, call `GET /health`, run a quick game flow. |
| **2** | Add DB indexes (new migration) for games, game_players, game_properties, game_play_history | Run migrations, run existing app and play a game. |
| **3** | Add analytics backend: events table + store key actions (game_started, game_ended, etc.) + dashboard API | Create/join/finish game, then call dashboard API. |
| **4** | Add analytics dashboard frontend (counts, simple charts) | Open dashboard page, confirm numbers match. |
| **5** | (Later) Socket.io Redis adapter | Run 2 backend instances, connect clients, verify rooms. |
| **6** | (Later) Replace polling with Socket.io events | Play game and confirm no unnecessary refetch bursts. |
| **7** | (Later) Connection limits and socket event rate limiting | Verify new connections and events are limited. |

---

## 5. Analytics dashboards for user feedback

**Goal:** So you can see what users do and react to feedback (e.g. drop-off, errors, popular flows).

**Planned:**

1. **Backend**
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

- **100–200k DAUs:** Not ready yet; we’re addressing pool size, indexes, Redis caching, and polling.
- **200 concurrent players:** Not ready yet; we’re addressing Socket.io scaling, connection/event limits, and locking.
- **Frontend standards:** Yes; stack is industry-standard.
- **Next:** Execute Steps 1–4 (config + indexes + analytics backend + dashboard), then iterate on scaling (Redis adapter, less polling, limits).

All changes are done step by step with tests between each step so nothing breaks.
