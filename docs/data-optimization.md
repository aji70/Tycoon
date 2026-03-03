# Data & Query Optimization

**Last updated:** March 2026

Notes on N+1 fixes and optimistic locking for the backend.

---

## 1. N+1 query fixes

### 1.1 Active / pending games list

**Endpoints:** `GET /games/active`, `GET /games/pending` (or equivalent list endpoints).

**Before:** For each game, two extra queries (settings, players) → 1 + 2N queries for N games.

**After:** Batch load settings and players for all game IDs, then group in memory.

- **GameSetting.findByGameIds(gameIds)** — returns all settings for the given game IDs (single query).
- **GamePlayer.findByGameIds(gameIds)** — returns all players for the given game IDs, with user join (single query).

So we now use 3 queries total (games, settings, players) regardless of list size (within the limit).

**Files:** `backend/models/GameSetting.js`, `backend/models/GamePlayer.js`, `backend/controllers/gameController.js` (findActive, findPending).

---

## 2. Optimistic locking (where safe)

**Idea:** For high-contention updates (e.g. game state, balance), use a `version` column (or `updated_at`) so that an update only succeeds if the row has not been changed by another request. Reduces lost updates and race conditions.

**Suggested places:**

- **games:** Add `version` (integer), increment on every update. When updating `next_player_id`, status, etc., use `WHERE id = ? AND version = ?` and set `version = version + 1`. If `rowCount === 0`, return a conflict and let the client refetch and retry.
- **game_players:** Same pattern for balance and position updates if multiple writers (e.g. auction resolve, rent, trade) can hit the same row.

**Current status:** Not implemented. The codebase uses transactions and single-statement updates; adding `version` would require a migration and changes in the relevant controllers. Consider for production under high concurrency.

---

## 3. Other query patterns

- **Game by code:** Already loads settings, players, history, active_auction in a small number of queries (no per-item N+1 in the list).
- **Auction:** Single auction per game; `getActiveByGameId` uses joins and one extra query for players — acceptable.
