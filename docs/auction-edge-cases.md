# Auction Edge Cases

**Version:** 1.0  
**Last updated:** March 2026

This document describes how the in-game property auction handles edge cases: timeout, reconnection, and ties.

---

## 1. Overview

When a player lands on an unowned property and declines to buy, an auction starts. All players (in turn order) may bid or pass. When everyone has acted (bid or pass), the highest bidder wins and pays; the decliner’s turn ends and play continues.

- **Backend:** `backend/controllers/auctionController.js` — `getActiveByGameId`, `placeBid`, `resolveAuction`.
- **State:** `game_auctions` (open/closed), `game_auction_bids` (per player, amount or pass).

---

## 2. Timeout

**Current behavior:** There is no server-side timeout for auction turns. If the current bidder never submits a bid or pass, the auction stays open until they act.

**Recommendations:**

- **Frontend:** Show a clear “Your turn to bid” state and optional countdown (e.g. reusing the game’s turn timer if present).
- **Backend (future):** Optional auction turn timeout (e.g. 60–120 seconds). After timeout, treat the current bidder as “pass” and advance:
  - Insert a pass (null amount) for that player.
  - If all players have now acted, call the same resolve logic; otherwise the next bidder’s turn starts.
- Implementation would require either:
  - A `last_bid_at` (or `auction_started_at`) plus a periodic job/cron that checks for stale auctions and auto-passes, or
  - Reusing the game’s existing turn timeout (e.g. `turn_start` / `last_timeout_turn_start`) if the rules allow treating “no action” as pass.

---

## 3. Reconnection During Auction

**Current behavior:** Auction state is fully stored in the database (`game_auctions`, `game_auction_bids`). There is no in-memory-only state.

- When a client reconnects (or refreshes), they fetch the game (e.g. `GET /games/by-code/:code` or equivalent). The response includes `active_auction` when there is an open auction.
- The client can show the same auction UI (property, current high, next bidder, list of bids) and allow the user to bid or pass as normal.
- No special “reconnection” logic is required; the client just uses the latest game payload and `active_auction` again.

**Recommendation:** Ensure the game board (and any auction modal) re-fetches or subscribes to game updates (e.g. WebSocket) so that after reconnect the user sees the current auction state and whose turn it is.

---

## 4. Ties (Equal Highest Bids)

**Current behavior:** If two or more players submit the same highest bid amount, the **first** such bid in the order we process them is chosen as the winner. In the implementation this is done with a `reduce` that keeps the current best and only replaces when `b.amount > (best?.amount ?? 0)`, so when amounts are equal the existing best is kept (first highest bidder wins).

**Tie-breaker rule (documented):** Among equal highest bids, the winner is the one that appears first in the iteration (effectively first highest bidder by submission order). This is deterministic and does not require extra fields (e.g. bid id or timestamp). If a stricter tie-breaker is needed later (e.g. by turn order, then by bid time), the resolve logic can be extended to sort by `(amount DESC, turn_order ASC, id ASC)` and pick the first.

---

## 5. Summary

| Edge case       | Behavior | Notes |
|-----------------|----------|--------|
| **Timeout**     | No server timeout | Optional: add turn timeout and auto-pass (future). |
| **Reconnection**| Full state in DB  | Client re-fetches game; `active_auction` restores UI. |
| **Ties**        | First highest bidder wins | Deterministic; can be refined later (e.g. turn order). |
