# AI Board (Desktop) → 3D Board Parity Checklist

This document lists characteristics and behaviour from the **desktop AI board** (`AiBoard` in `frontend/components/game/ai-board/ai-board.tsx`) that should be brought to the **3D board** (board-3d when used with a live AI game). Implement one at a time; check off when done.

**Scope:** Desktop only (3D board route: `board-3d?gameCode=...`).

---

## 1. Roll Dice (center)

- [x] **1.1** Roll Dice button visible in 3D board center when it's the human player's turn and they can roll (not in jail choice, not game-over, balance > 0).
- [x] **1.2** Clicking Roll triggers 3D dice animation, then sends roll to backend (`/game-players/change-position` with `rolled`, `position`, `is_double`).
- [x] **1.3** After roll, show last roll result (e.g. die1 + die2 = total) in center until next action.
- [x] **1.4** Roll disabled while rolling (no double-tap).
- [x] **1.5** Doubles: if backend indicates roll again, allow rolling again (no end-turn on doubles; Roll button shows again after refetch).

**Status:** Done.

---

## 2. Turn & identity

- [x] **2.1** Current player clearly indicated (highlight in sidebar, token styling in BoardScene).
- [x] **2.2** "Me" (human) derived from wallet/guest and shown correctly in players list.
- [x] **2.3** AI turn: show "AI thinking..." + spinner; no Roll button for human during AI turn.

**Status:** Done.

---

## 3. Movement & position

- [x] **3.1** After human roll, animate token movement along board (step-by-step).
- [x] **3.2** After API refetch, 3D board positions stay in sync with `game.players[].position`.
- [x] **3.3** Support "doubles" (move, then allow second roll without ending turn).

**Status:** Done.

---

## 4. Buy / Skip (landing on property)

- [x] **4.1** When human lands on unowned property, show Buy / Skip in UI (overlay) _after_ movement animation completes.
- [x] **4.2** Buy: call backend (`/game-properties/buy`), refetch game, update 3D state, then end turn.
- [x] **4.3** Skip: decline purchase and end turn.
- [ ] **4.4** Optional: show buy score / AI-style tip for human.

**Status:** 4.1–4.3 done.

---

## 5. Jail

- [x] **5.1** In jail, before roll: show Pay $50 / Use Get Out of Jail Free / Roll for doubles.
- [x] **5.2** Pay $50: call `/game-players/pay-to-leave-jail`, then allow roll.
- [x] **5.3** Use card: call use-get-out-of-jail endpoint, then allow roll.
- [x] **5.4** After rolling from jail with no doubles: show Pay / Use card / Stay; call corresponding endpoints.
- [x] **5.5** Stay in jail: call stay-in-jail, end turn.

**Status:** Done.

---

## 6. Cards (Chance / Community Chest)

- [x] **6.1** When human draws a card, show card modal (same content as 2D: text, effect, isGood).
- [x] **6.2** Card resolution (move, pay, collect, jail, etc.) applied via backend; refetch and sync 3D state.

**Status:** Done.

---

## 7. End turn

- [x] **7.1** After move + buy/skip (and any card), End Turn or auto-end when appropriate.
- [x] **7.2** Call `/game-players/end-turn` so backend advances to next player.
- [x] **7.3** AI turn runs on frontend (like 2D): strategy phase, then roll dice, animate token, call change-position, then buy/skip via agent or score; when it's human again, Roll Dice appears again.

**Status:** Done.

---

## 8. House rules / property actions

- [ ] **8.1** Optional: from 3D or sidebar, open property detail (develop, mortgage, unmortgage) for owned properties.
- [ ] **8.2** Optional: Develop / downgrade / mortgage / unmortgage call same endpoints as 2D.

**Status:** Not implemented (optional).

---

## 9. Game end & time

- [x] **9.1** Game time up (duration countdown): show "Time's Up" and winner/loser modal (same as 2D).
- [x] **9.2** Finish-by-time: call finish-by-time endpoint; show winner/loser and "Go home".
- [ ] **9.3** Optional: untimed games — vote to end by net worth.

**Status:** 9.1–9.2 done.

---

## 10. Bankruptcy

- [x] **10.1** When human is bankrupt (balance ≤ 0), show "Declare bankruptcy" button; on confirm show bankruptcy modal (tokens awarded, return home).
- [x] **10.2** Call backend to end game with winner = opponent; sync state.

**Status:** Done.

---

## 11. UI / UX parity

- [x] **11.1** Action log (history) visible and updates after each move/roll/buy/card.
- [x] **11.2** Players panel: balances, positions, "current turn" highlight.
- [x] **11.3** Toasts for "Bought X", errors, jail actions, etc.
- [ ] **11.4** Optional: Perks / collectibles panel (e.g. sparkle button) and use in 3D.

**Status:** 11.1–11.3 done.

---

## 12. Optional (nice-to-have)

- [ ] **12.1** Trade alert / incoming trades (if AI game supports trades).
- [ ] **12.2** Sound or subtle feedback on roll / move / buy.
- [x] **12.3** Fullscreen toggle (already on 3D).

---

_Last updated: full parity implementation (desktop). Remaining: optional 3.1 (step animation), 4.4, 8.x, 9.3, 11.4, 12.1–12.2._
