# Checklist: What We Need to Do to Match Lena’s Ask

Lena’s requests:

1. **Analysis** – Is it scalable for 100–200k DAUs? What when 200 play at once? Industry-standard frontend?
2. **Execute all improvements** – Step by step, test in between so nothing breaks.
3. **Analytics dashboards** – So you can deal with user feedback.

---

## ✅ Done (matches Lena)

| # | Lena asked | Status |
|---|------------|--------|
| 1 | Analysis of project (scalability, concurrency, frontend standards) | ✅ Done – see `SCALABILITY_ANALYSIS.md` and `ANALYTICS_SUMMARY.md` |
| 2 | Step-by-step improvements (test in between) | ✅ Steps 1–4 done (pool, indexes, analytics backend, dashboard) |
| 3 | Start building analytics dashboards for user feedback | ✅ One dashboard at `/analytics` with game counts and events |

**Implemented so far:** DB pool increase (prod), Redis `setex`/`del`, scalability indexes migration, `analytics_events` table, `GET /api/analytics/dashboard`, `recordEvent('game_created')`, and the `/analytics` dashboard page.

---

## ✅ Steps 5–10 implemented (Feb 2026)

| Step | What was done |
|------|----------------|
| **5** | Socket.io Redis adapter in `config/socketRedis.js`; server starts with `connectSocketRedis()` and attaches adapter when Redis is available (skip when `SKIP_REDIS=true`). |
| **6** | Backend emits `game-update` on state changes (join, leave, update, finishByTime, changePosition, endTurn). Frontend game-play page subscribes via `socketService.onGameUpdate`, invalidates queries on event; refetch interval increased to 30s. |
| **7** | Per-IP connection limit (5) and per-socket event rate limit (60/min) in `server.js` Socket.io connection handler. |
| **8** | Redis cache for `findByCode` in `utils/gameCache.js` (60s TTL); cache invalidated on update/join/leave/finish and in gamePlayerController after changePosition/endTurn. |
| **9** | Pino logger in `config/logger.js`; used in `server.js`, `gameController.js`, `gamePlayerController.js`, `analytics` route, and `socketHelpers.js`. |
| **10** | `/health` checks DB (`SELECT 1`) and Redis (`get`); returns `{ status, db, redis, timestamp, environment }` with 503 when degraded. |

---

## ❌ Optional follow-ups (beyond steps 5–10)

Steps 5–10 are done. Remaining (from analysis):

- **N+1 / locking:** Fix N+1 queries with joins; add optimistic locking where safe.
- **Load testing:** e.g. k6 with 200 VUs to confirm 200+ concurrent users.
- **Monitoring:** Sentry, APM, or similar.

### “Analytics dashboards” for user feedback – extend what we have

| Item | What to do |
|------|------------|
| **More events** | Emit `game_started`, `game_finished`, `game_joined`, and optionally `error` (with code/message) via `recordEvent()` so the dashboard reflects real user flows. |
| **Dashboard that helps feedback** | On `/analytics`: add “Games started vs finished” (or similar) so you can see drop-off; add a simple “games over time” (e.g. last 7 days) if you have the data. |
| **Protect dashboard** | Restrict `GET /api/analytics/*` and the `/analytics` page (e.g. admin-only or API key) before production. |
| **Optional** | Date range filter, export CSV, or a second dashboard tab for “errors” or “recent activity” when you have those events. |

---

## One-line summary

**Lena’s ask is met:** Analysis done, steps 1–10 implemented (pool, indexes, analytics backend + dashboard, Redis adapter, socket-driven updates, connection/event limits, Redis caching, Pino logging, health checks). Optional: more analytics events, dashboard protection, N+1 fixes, load testing, monitoring.
