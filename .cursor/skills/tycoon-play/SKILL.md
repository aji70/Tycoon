---
name: tycoon-play
description: Helps the user play the Tycoon game (Monopoly-style on-chain). Explains rules, UI flows, create/join game, roll dice, buy/sell/trade, and common fixes. Use when the user asks how to play Tycoon, is stuck in the game, cannot see Roll Dice, cannot create games, or needs gameplay or setup help.
---

# Tycoon Play Helper

Use this skill when the user needs help **playing** Tycoon (the Monopoly-style blockchain game in this repo): rules, where to click, why something doesn’t work, or how to get set up.

## What Tycoon Is

- **Game**: Monopoly-style. Roll dice, move, buy/sell properties, collect rent, build houses/hotels, trade, go to jail. Win by bankrupting others or (in timed games) having highest net worth.
- **Stack**: Next.js frontend, Node backend, EVM contracts (Celo default). Players can use **Privy** (email/social, no wallet) or connect a wallet.
- **Key idea**: “Wallet-first” users get a **smart wallet** at signup (no linked EOA). Their on-chain identity is `smart_wallet_address`; the placeholder in the DB is only for display until they link a wallet.

## When to Use This Skill

- User asks how to play, how to create/join a game, or where Roll Dice is.
- User says they can’t create games, can’t see Roll Dice, or aren’t registered on-chain.
- User needs gameplay rules or UI navigation (e.g. buy from bank, sell to bank, trade, jail).
- User is setting up backend/env and wants to know what’s required for gameplay (e.g. registry, faucet).

## Core Flows (What the User Does)

| Goal | Where (frontend) | Notes |
|------|------------------|--------|
| Sign up (no wallet) | Sign in with Privy, pick username | Creates DB user + on-chain smart wallet if backend is configured |
| Create game | Home → Create Game (or Rooms) | Guest/Privy: backend “create-as-guest”; needs contract + registry owner key for on-chain |
| Join game | Enter 6-letter code or link | Join-as-guest uses backend; user must be resolved as `me` (see below) |
| Roll dice | On board when it’s their turn | Button in center area; only visible when `playerCanRoll` (my turn, not in buy prompt, etc.) |
| Buy property | After rolling, land on unowned property | Buy / Skip; then turn ends (or roll again on doubles) |
| Sell to bank | Property actions / sell | Backend calls transferPropertyOwnership(seller, "Bank") |
| Buy from bank | Unowned property → buy from bank | Backend calls transferPropertyOwnership("Bank", buyer) |
| Trade | With another player | Propose / accept; backend records transfer on-chain via Game Faucet |

## How “Me” Is Resolved (Critical for Roll Dice / Turns)

The board resolves the current user’s player (`me`) by matching `game.players[].address` to **any** of:

- `guestUser?.address` (placeholder for Privy-only)
- `guestUser?.linked_wallet_address`
- **`guestUser?.smart_wallet_address`** (on-chain identity for wallet-first)
- Connected wallet `address`

If the user signed up with Privy and has a smart wallet, the **game** stores their player under `smart_wallet_address`. If the frontend only matched `guestUser?.address` (placeholder), `me` was null → no “Roll Dice” and no turn. The fix (already in repo) is to include `smart_wallet_address` in the list of addresses when resolving `me` on all board pages.

## Backend Config Needed for Playing

- **Contract (create/join/roll/end game)**: `CELO_RPC_URL`, `TYCOON_CELO_CONTRACT_ADDRESS` (proxy address), `BACKEND_GAME_CONTROLLER_PRIVATE_KEY`.
- **Wallet-first signup (on-chain at signup)**: `TYCOON_USER_REGISTRY_CELO` (new registry address), `TYCOON_OWNER_PRIVATE_KEY` (registry owner key). Without these, new users get a DB account but no on-chain registration → “Guest authentication required” when creating games until they link a wallet or you fix env.
- **Property sale recording (buy/sell/trade)**: `TYCOON_GAME_FAUCET_ADDRESS`. Backend calls Game Faucet `recordPropertySale(seller, buyer)`; if faucet is missing, no tx is sent (only a logged error).

## Common Issues and Fixes

| Issue | Cause | Fix |
|-------|--------|-----|
| “Guest authentication required. Link a wallet or use a guest account that can create games.” | Backend create-as-guest uses `linked_wallet \|\| smart_wallet \|\| address`. User had no linked wallet and no smart wallet in DB, or backend wasn’t using smart_wallet for contract. | Ensure wallet-first signup ran (registry + owner key in backend .env). Ensure gameController uses `smart_wallet_address` when present for create/join (already in repo). |
| Can’t see Roll Dice on board | `me` was null because game stores player by smart wallet but frontend only matched placeholder address. | Resolve `me` using `smart_wallet_address` (and linked_wallet_address) as well as placeholder/address (already in repo on board pages). |
| New users not registered on-chain | Registry not configured or wrong key. | Set `TYCOON_USER_REGISTRY_CELO`, `TYCOON_OWNER_PRIVATE_KEY` in backend .env; ensure proxy points at new registry. |
| No property-sale txs on Game Faucet on scan | Backend only sends tx when buy/sell/trade happens; and only if Game Faucet is set. | Set `TYCOON_GAME_FAUCET_ADDRESS` in backend .env; trigger a buy-from-bank or sell-to-bank or trade and check logs for “transferPropertyOwnership” / “recordPropertySale”. |

## Where Things Live in the Repo

- **Board (multiplayer)**: `frontend/app/(room)/board-3d-mobile/page.tsx`, `board-3d/page.tsx`, `board-3d-multi/page.tsx`, `board-3d-multi-mobile/page.tsx`. “Me” resolution and `playerCanRoll` / `onRollDice` live here.
- **AI board**: `frontend/app/(room)/ai-play/page.tsx`, `ai-play-3d/page.tsx`.
- **Create/join as guest**: `backend/controllers/gameController.js` (`createAsGuest`, join flow). Uses `ensureUserHasContractPassword` with address = linked_wallet \|\| smart_wallet \|\| user.address.
- **Auth (Privy, me)**: `frontend/context/GuestAuthContext.tsx` (guestUser with `smart_wallet_address`); `backend/controllers/guestAuthController.js` (privySignin, wallet-first registration).
- **Property sale on-chain**: `backend/controllers/gamePropertyController.js` (buy from bank, sell to bank, update); `backend/services/tycoonContract.js` (`setPropertyStats` → Game Faucet `recordPropertySale`).
- **How to play (rules)**: `frontend/app/how-to-play/page.tsx`.

## How to Help the User

1. **“How do I play?”** → Point to in-app How to Play and summarize: roll dice, buy/sell/trade properties, collect rent, build, avoid bankruptcy; win by last standing or highest net worth in timed.
2. **“I can’t create a game” / “Guest authentication required”** → Check backend env (registry + owner key for wallet-first; or link a wallet). Confirm they have a smart_wallet_address or linked wallet so create-as-guest can resolve a contract identity.
3. **“I don’t see Roll Dice”** → Confirm it’s their turn and they’re not in a buy prompt or jail choice. If they’re wallet-first, ensure frontend resolves `me` with `smart_wallet_address` (already in repo).
4. **“Am I on-chain?”** → Backend signup response includes `on_chain_registered` and `smart_wallet_address`; or check `/auth/me`. If not registered, fix backend registry/owner key and have them sign up again (or use “Create smart wallet” in profile if available).
5. **“Where do property transfers happen?”** → On-chain: Game Faucet contract `recordPropertySale` (backend calls it). Backend must have `TYCOON_GAME_FAUCET_ADDRESS` set.

Keep answers short and actionable; point to env vars, specific files, or in-app screens as needed.
