# Backend ↔ Tycoon Contract (Celo)

The backend can perform **game controller** actions on the Tycoon contract when configured.

## Setup

1. **Env vars** (see `.env.example`):
   - `CELO_RPC_URL` – Celo RPC (e.g. `https://rpc.ankr.com/celo`)
   - `TYCOON_CELO_CONTRACT_ADDRESS` – Deployed Tycoon contract address (Celo)
   - `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` – Wallet private key (0x…). This wallet must be set as **backend game controller** on the contract (`setBackendGameController(backendWallet)` by owner).

2. **Migration**: Run `npm run migrate` so `games.contract_game_id` exists. The create-game flow stores the on-chain game id when the frontend sends `id: onChainGameId`.

3. **Check**: `isContractConfigured()` from `services/tycoonContract.js` is true when all three env vars are set.

## Usage

Import from `services/tycoonContract.js`:

- **`setTurnCount(gameId, playerAddress, count)`**  
  Call **once** when a player reaches the min-turns threshold (e.g. 20). Use `game.contract_game_id` and the player’s wallet address. Required for voluntary exit to get full perks.

- **`removePlayerFromGame(gameId, playerAddress, turnCount)`**  
  Use when removing a player (vote-out / stall). Pass DB `turn_count` for the min-turns perk check. Use `game.contract_game_id`; update your DB after (e.g. set player as removed / game finished).

- **`transferPropertyOwnership(sellerUsername, buyerUsername)`**  
  Call when a player-to-player property sale is finalized. Usernames must be the on-chain registered names.

## When to call

| Action | When |
|--------|------|
| `setTurnCount(gameId, player, 20)` | Once when `game_players.turn_count` reaches 20 (or your `minTurnsForPerks`) for that game/player. |
| `removePlayerFromGame(gameId, player, turnCount)` | When you decide to remove the player (e.g. vote-out or stall); use current `turn_count` from DB. |
| `transferPropertyOwnership(seller, buyer)` | When a P2P property sale is confirmed; use on-chain usernames. |

## Example (setTurnCount when turn reaches 20)

```js
import { setTurnCount, isContractConfigured } from "../services/tycoonContract.js";

// In your turn-completion or game loop logic:
if (isContractConfigured() && game.contract_game_id && newTurnCount >= 20 && previousTurnCount < 20) {
  try {
    await setTurnCount(game.contract_game_id, playerAddress, newTurnCount);
  } catch (err) {
    logger.warn({ err, gameId: game.id }, "Contract setTurnCount failed");
  }
}
```

## Security

- Never expose `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` (no `NEXT_PUBLIC_*`, no client).
- The game controller wallet can only call the three functions above; it cannot drain funds or change contract owner.
