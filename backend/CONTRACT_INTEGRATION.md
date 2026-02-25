# Backend ↔ Tycoon Contract (multi-chain)

The backend can perform **game controller** actions on the Tycoon contract when configured. It supports **multiple chains** (CELO, POLYGON, BASE); each chain has its own RPC, contract address, and optional private key.

**Architecture:** This backend is shared. The repo’s frontend may be Celo-only; a separate frontend for Polygon (or Base) uses this same backend. The backend chooses which chain’s contract to call using `game.chain` (or request body `chain`). Config is in `config/chains.js`; contract calls take an optional `chain` argument (default `"CELO"`).

## Setup

1. **Env vars** (see `.env.example`):
   - **Celo:** `CELO_RPC_URL`, `TYCOON_CELO_CONTRACT_ADDRESS`, `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` (or `BACKEND_GAME_CONTROLLER_CELO_PRIVATE_KEY`)
   - **Polygon (optional):** `POLYGON_RPC_URL`, `TYCOON_POLYGON_CONTRACT_ADDRESS`, `BACKEND_GAME_CONTROLLER_POLYGON_PRIVATE_KEY`
   - **Base (optional):** `BASE_RPC_URL`, `TYCOON_BASE_CONTRACT_ADDRESS`, `BACKEND_GAME_CONTROLLER_BASE_PRIVATE_KEY`

   The wallet must be set as **backend game controller** on each chain’s contract (`setBackendGameController(backendWallet)` by owner).

2. **Migration**: Run `npm run migrate` so `games.contract_game_id` and `games.chain` exist. The create-game flow stores the on-chain game id and chain when the frontend sends them.

3. **Check**: `isContractConfigured(chain)` is true when that chain’s env vars are set; `isContractConfigured()` (no arg) is true if **any** chain is configured.

## Usage

Import from `services/tycoonContract.js`. All contract functions accept an optional **last argument `chain`** (e.g. `"CELO"`, `"POLYGON"`, `"BASE"`). Default is `"CELO"`. Use `User.normalizeChain(game.chain)` when you have a game.

- **`setTurnCount(gameId, playerAddress, count, chain?)`**  
  Call **once** when a player reaches the min-turns threshold (e.g. 20). Use `game.contract_game_id` and the player’s wallet address. Required for voluntary exit to get full perks.

- **`removePlayerFromGame(gameId, playerAddress, turnCount, chain?)`**  
  Use when removing a player (vote-out / stall). Pass DB `turn_count` for the min-turns perk check. Use `game.contract_game_id`; update your DB after (e.g. set player as removed / game finished).

- **`transferPropertyOwnership(sellerUsername, buyerUsername, chain?)`**  
  Call when a player-to-player property sale is finalized. Usernames must be the on-chain registered names.

## When to call

| Action | When |
|--------|------|
| `setTurnCount(gameId, player, 20)` | Once when `game_players.turn_count` reaches 20 (or your `minTurnsForPerks`) for that game/player. |
| `removePlayerFromGame(gameId, player, turnCount)` | When you decide to remove the player (e.g. vote-out or stall); use current `turn_count` from DB. |
| `transferPropertyOwnership(seller, buyer)` | When a P2P property sale is confirmed; use on-chain usernames. |

## Example (setTurnCount when turn reaches 20)

```js
import User from "../models/User.js";
import { setTurnCount, isContractConfigured } from "../services/tycoonContract.js";

const chain = User.normalizeChain(game.chain || "CELO");
if (isContractConfigured(chain) && game.contract_game_id && newTurnCount >= 20 && previousTurnCount < 20) {
  try {
    await setTurnCount(game.contract_game_id, playerAddress, newTurnCount, chain);
  } catch (err) {
    logger.warn({ err, gameId: game.id }, "Contract setTurnCount failed");
  }
}
```

## Security

- Never expose `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` (no `NEXT_PUBLIC_*`, no client).
- The game controller wallet can only call the three functions above; it cannot drain funds or change contract owner.
