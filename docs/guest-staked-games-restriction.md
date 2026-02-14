# Guest Staked Games Restriction

**Version:** 1.0  
**Date:** February 2025  
**Summary:** Guests (play-without-wallet users) cannot create or join staked games. Enforcement is implemented on the backend and frontend; the smart contract is unchanged.

---

## 1. Overview

### 1.1 Purpose

- **Guests** are users who play without connecting a wallet. They authenticate with username/password; the backend holds a custodial wallet and acts on their behalf via contract `*ByBackend` functions.
- **Staked games** require each player to lock USDC (or other stake) on-chain. Only wallet-connected users can approve and transfer USDC.
- To avoid inconsistent state and to keep guest flows simple, **guests are restricted to free (zero-stake) games only**: they cannot create staked games, and they cannot join games that have a non-zero stake per player.

### 1.2 Enforcement Layers

| Layer        | Create staked game     | Join staked game        |
|-------------|------------------------|--------------------------|
| **Backend** | Reject with 403        | Reject with 403          |
| **Frontend**| Force stake 0, hide UI | Block join + show message|
| **Contract**| Not changed            | Not changed              |

The contract does not distinguish “guest” vs “wallet” users; the backend never calls `createGameByBackend` or `joinGameByBackend` with non-zero stake for guests.

---

## 2. Backend

**File:** `backend/controllers/gameController.js`

### 2.1 Create-as-Guest: Reject Non-Zero Stake

**Endpoint:** `POST /games/create-as-guest`  
**Auth:** `Authorization: Bearer <guest JWT>` (user must have `is_guest` and `password_hash`).

**Behavior:**

- Request body may include `stake` (number, USDC amount).
- If `stake > 0` (after `Number(stake) || 0`):
  - Response: **403**
  - Body:  
    `{ "success": false, "message": "Guests cannot create staked games. Please connect a wallet to create a staked game." }`
- If stake is 0 or missing, the game is created with `stakeAmount = 0n` on-chain (guests always create free games).

**Relevant code:**

- Validation: reject when `stakeNum > 0`.
- On success path: `stakeAmount = 0n` (no longer derived from `req.body.stake` for guests).

### 2.2 Join-as-Guest: Reject Staked Games

**Endpoint:** `POST /games/join-as-guest`  
**Auth:** Same as above (guest JWT).

**Behavior:**

- Request body: `{ code, symbol, joinCode? }`.
- Game is loaded from DB by `code`; `contract_game_id` is required.
- Before calling `joinGameByBackend`, the backend reads the on-chain game:
  - `callContractRead("getGame", [contractGameId])`
  - From the returned struct, `stakePerPlayer` is read (or tuple index `9` for compatibility).
- If `stakePerPlayer > 0`:
  - Response: **403**
  - Body:  
    `{ "success": false, "message": "Guests cannot join staked games. Connect a wallet to join this game." }`
- If stake is 0, the existing join-as-guest flow continues (on-chain join + DB `GamePlayer` creation, etc.).

**Dependency:**

- `callContractRead` is imported from `backend/services/tycoonContract.js` (already supports `getGame`).

---

## 3. Frontend

### 3.1 Create Game (Desktop & Mobile)

**Files:**

- `frontend/components/settings/game-settings.tsx`
- `frontend/components/settings/game-settings-mobile.tsx`

**When user is guest (`isGuest === true`):**

1. **Payload**
   - All create-as-guest requests send:
     - `stake: 0`
     - `use_usdc: false`
   - Any local “stake” or “free game” state is ignored for the API call.

2. **UI**
   - **Free Game toggle** and **Entry Stake** section are hidden.
   - A single notice is shown instead, e.g.:
     - **Desktop:** “Guest games are free” / “Connect a wallet to create staked games”.
     - **Mobile:** Same idea, compact copy.
   - Guests never see stake presets (1, 5, 10, 25, 50, 100 USDC) or custom stake input.

**Result:** Guests can only create free games; the UI and request body are aligned with backend rules.

---

### 3.2 Join Game: Waiting Room Hook

**File:** `frontend/components/settings/useWaitingRoom.ts`

**New/computed:**

- `guestCannotJoinStaked`: `!!guestUser && stakePerPlayer > 0n`
- `stakePerPlayer` comes from `contractGame?.stakePerPlayer` (on-chain game by code).

**In `handleJoinGame` (when `guestUser` is set):**

1. **Before** calling `POST /games/join-as-guest`:
   - If `stakePerPlayer > 0n`:
     - Set error state so the waiting room can show a message.
     - Update the loading toast to: “Guests cannot join staked games. Connect a wallet to join.”
     - Set `actionLoading` to `false` and **return** (no API call).
2. **If** `stakePerPlayer === 0n`, the existing join-as-guest request is sent as before.

**Returned from hook:**

- `guestCannotJoinStaked` (boolean)
- `guestUser` (guest object or null)

These are used by the waiting room components to disable the Join button and show a clear message.

---

### 3.3 Waiting Room UI (Desktop & Mobile)

**Files:**

- `frontend/components/settings/game-waiting.tsx`
- `frontend/components/settings/game-waiting-mobile.tsx`

**When `guestCannotJoinStaked` is true:**

1. **Message**
   - A short notice is shown near the Join controls, e.g.:  
     “Guests cannot join staked games. Connect a wallet to join this game.”
   - Same message is included in the general error area at the bottom when `guestCannotJoinStaked` is true.

2. **Join button**
   - Disabled when `guestCannotJoinStaked` is true (in addition to existing conditions like `!playerSymbol`, `actionLoading`, `isJoining`, etc.).
   - Applies to both:
     - Non-creator join block (pick token + Join).
     - Creator join block (when creator has not yet joined).

**Result:** Guests see a clear explanation and cannot attempt to join staked games from the UI; the backend would reject them if they did.

---

## 4. User-Facing Messages

| Context              | Message |
|----------------------|--------|
| Create (backend 403)  | “Guests cannot create staked games. Please connect a wallet to create a staked game.” |
| Join (backend 403)    | “Guests cannot join staked games. Connect a wallet to join this game.” |
| Create (frontend)    | “Guest games are free” / “Connect a wallet to create staked games” |
| Join (frontend)      | “Guests cannot join staked games. Connect a wallet to join this game.” |
| Join toast (frontend) | “Guests cannot join staked games. Connect a wallet to join.” |

---

## 5. API Summary

### 5.1 POST /games/create-as-guest

- **403** when `stake > 0` in body.  
- Message: `"Guests cannot create staked games. Please connect a wallet to create a staked game."`  
- On success, game is always created with zero stake on-chain.

### 5.2 POST /games/join-as-guest

- **403** when the game’s on-chain `stakePerPlayer > 0`.  
- Message: `"Guests cannot join staked games. Connect a wallet to join this game."`  
- Stake is read via `callContractRead("getGame", [contract_game_id])`; no new DB columns are required.

---

## 6. Contract

**File:** `contract/src/Tycoon.sol`

- No code changes.
- The contract allows `createGameByBackend` and `joinGameByBackend` with any stake; the backend simply never sends non-zero stake for guest users.
- Optional: a comment in the contract or in backend could state that “backend must not call these with non-zero stake for guest users”; the current doc serves that role.

---

## 7. Testing Checklist

- [ ] Guest creates game: request with `stake: 0` → 201, game on-chain has `stakePerPlayer === 0`.
- [ ] Guest creates game: request with `stake: 10` → 403 and message above.
- [ ] Guest joins free game (by code) → 201, player added.
- [ ] Guest joins staked game (by code) → 403 and message above.
- [ ] Frontend create (guest): only “free” option visible; no stake UI; payload has `stake: 0`, `use_usdc: false`.
- [ ] Frontend waiting room (guest, staked game): message shown, Join button disabled, no join request sent.
- [ ] Wallet user: can still create and join staked games as before.

---

## 8. Related Files (Quick Reference)

| Area     | File(s) |
|----------|---------|
| Backend  | `backend/controllers/gameController.js` (`createAsGuest`, `joinAsGuest`) |
| Contract read | `backend/services/tycoonContract.js` (`callContractRead`, `getGame`) |
| Create UI | `frontend/components/settings/game-settings.tsx`, `game-settings-mobile.tsx` |
| Join logic | `frontend/components/settings/useWaitingRoom.ts` |
| Join UI   | `frontend/components/settings/game-waiting.tsx`, `game-waiting-mobile.tsx` |
