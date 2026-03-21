# Tycoon Smart Contracts

Monopoly-style game and reward system implemented in Solidity. The codebase consists of **TycoonRewardSystem** (ERC-1155 vouchers and collectibles) and **Tycoon** (registration, games, stakes, and payouts).

---

## Table of Contents

- [Overview](#overview)
- [Contracts](#contracts)
- [TycoonRewardSystem](#tycoonrewardsystem)
- [Tycoon (Main Game)](#tycoon-main-game)
- [Deployment & Setup](#deployment--setup)
- [Backend Integration](#backend-integration)
- [Development](#development)

---

## Overview

- **Chain:** EVM-compatible (e.g. Base, Ethereum).
- **Tokens:** TYC (ERC-20) for rewards; USDC (ERC-20) for stakes and shop.
- **Rewards:** ERC-1155 vouchers (redeemable for TYC) and collectibles (burnable for in-game perks).
- **Game flow:** Register → Create/Join game (optional USDC stake) → Play (off-chain) → Exit or get removed → Payout by rank (USDC + vouchers + collectibles).

---

## Contracts

| Contract               | Purpose                                                                 |
|------------------------|-------------------------------------------------------------------------|
| `TycoonRewardSystem`   | Vouchers, collectibles, shop, redeem, burn-for-perk.                    |
| `Tycoon`               | Users, games (create/join/leave/exit/remove), stakes, payouts.         |
| `TycoonTournamentEscrow` | Tournament entry fees + prize pool in USDC; finalize payouts to winners. |
| `TycoonLib`            | Shared enums, structs, validation, payout math.                        |
| `TycoonToken`          | Test/mock ERC-20 (TYC / USDC).                                         |

---

## TycoonRewardSystem

ERC-1155 contract for rewards and collectibles.

### Token ID Ranges

- **1_000_000_000+** → Vouchers (redeemable for TYC).
- **2_000_000_000+** → Collectibles (perks).

### Main Functions

| Function                 | Access        | Description                                      |
|--------------------------|---------------|--------------------------------------------------|
| `mintVoucher(to, tycValue)` | Backend/Owner | Mint 1 voucher redeemable for `tycValue` TYC.    |
| `redeemVoucher(tokenId)` | Anyone        | Burn voucher, receive TYC (when not paused).     |
| `mintCollectible(to, perk, strength)` | Backend/Owner | Mint collectible (non-shop).                     |
| `stockShop(amount, perk, strength, tycPrice, usdcPrice)` | Backend/Owner | Add shop listing.                                |
| `buyCollectible(tokenId, useUsdc)` | Anyone        | Buy 1 from shop with TYC or USDC.                |
| `burnCollectibleForPerk(tokenId)` | Anyone        | Burn 1 collectible to activate perk (off-chain).|
| `withdrawFunds(token, to, amount)` | Owner         | Withdraw TYC/USDC from contract.                 |

### Admin

- `setBackendMinter(address)` — who can mint (e.g. Tycoon contract).
- `pause()` / `unpause()` — disable redeem and shop.

### Cash Perks

Collectibles with perk `CASH_TIERED` or `TAX_REFUND` use fixed tiers (strength 1–5): **0, 10, 25, 50, 100, 250**.

---

## Tycoon (Main Game)

Manages players, games, stakes, and payouts.

### Registration

- `registerPlayer(username)` — one address per user, unique username. Mints **2 TYC** voucher to the user.
- Username: 1–32 characters. Code: up to 16 characters (validated via TycoonLib).

### Creating Games

**Human vs human (staked or free)**

- `createGame(creatorUsername, gameType, playerSymbol, numberOfPlayers, code, startingBalance, stakeAmount)`
- `gameType`: `"PUBLIC"` or `"PRIVATE"` (private requires non-empty `code`).
- `numberOfPlayers`: 2–8.
- If `stakeAmount > 0`: must be ≥ `minStake`; creator stakes first (USDC).

**AI game (no stake)**

- `createAIGame(creatorUsername, gameType, playerSymbol, numberOfAI, code, startingBalance)`
- 1 human + 1–7 AI; game starts as Ongoing immediately.

### Joining & Leaving Before Start

- `joinGame(gameId, playerUsername, playerSymbol, joinCode)` — join a pending game; stake USDC if required; private games require correct `joinCode`.
- `leavePendingGame(gameId)` — leave while game is still **Pending**; refunds full stake and decrements user stats. If last player leaves, game is set to Ended.

### Exiting an Ongoing Game

- **Voluntary:** `exitGame(gameId)` — caller exits and is paid by rank. Full perks (USDC + collectible + TYC) only if `turnsPlayed[gameId][player] >= minTurnsForPerks`; otherwise consolation (0.1 TYC) only.
- **Backend (vote-out / stall):** `removePlayerFromGame(gameId, player, turnCount)` — only `backendGameController` or owner. Same payout rules; `turnCount` from backend is used for min-turns check.

### Payouts (Staked Games)

- **House:** 5% of pot when the last player (winner) exits.
- **Distributable (95%):** Rank 1 → 50%, Rank 2 → 30%, Rank 3 → 20%. Rank 4+ → consolation voucher only.
- **Top 3:** USDC + 1 TYC voucher + random collectible (rank 1 gets strength 2).
- **Consolation:** 0.1 TYC voucher.

### Min Turns for Perks

- `minTurnsForPerks` (owner-set, 0 = disabled): minimum turns to get full perks on exit.
- **Voluntary exit:** Contract uses `turnsPlayed[gameId][player]`. Backend must call `setTurnCount(gameId, player, count)` **once** when the player reaches the threshold (e.g. 20).
- **Backend remove:** Contract uses the `turnCount` argument passed to `removePlayerFromGame`.

### Backend Game Controller

- `setBackendGameController(address)` — set/clear (use `address(0)` to disable) the backend that can:
  - `removePlayerFromGame(gameId, player, turnCount)`
  - `setTurnCount(gameId, player, count)`
  - `transferPropertyOwnership(sellerUsername, buyerUsername)` (stats only).

### Other Admin

- `setMinStake(amount)` — minimum USDC stake per player.
- `setMinTurnsForPerks(amount)` — minimum turns for full perks (0 = off).
- `withdrawHouse(amount)` — withdraw from house USDC.
- `drainContract()` — withdraw all USDC from Tycoon (e.g. emergency; use with care).

### View Functions

- `getUser(username)`, `getGame(gameId)`, `getGamePlayer(gameId, player)`, `getGameSettings(gameId)`, `getGameByCode(code)`, `getPlayersInGame(gameId)`, `getLastGameCode(user)`.

---

## TycoonTournamentEscrow

Holds USDC for tournament **entry fees** and **prize pools**. Tournament IDs match backend DB (`uint256`). Only owner or `backend` can create, lock, finalize, or cancel.

### Main Functions

| Function | Access | Description |
|----------|--------|-------------|
| `createTournament(tournamentId, entryFee, creator)` | Backend/Owner | Create or reconfigure; `entryFee` in USDC (0 = free), `creator` = prize funder address. |
| `fundPrizePool(tournamentId, amount)` | Anyone | Deposit USDC as prize pool (approve first). |
| `registerForTournament(tournamentId)` | Anyone | Pay entry fee (USDC); must approve first. Free if `entryFee == 0`. |
| `lockTournament(tournamentId)` | Backend/Owner | Lock so no more deposits. |
| `finalizeTournament(tournamentId, recipients[], amounts[])` | Backend/Owner | Send USDC to winners; total must not exceed pool. Records `(pool - sent)` in `pendingResidualUSDC` (house cut), then clears on-chain pool fields. |
| `cancelTournament(tournamentId)` | Backend/Owner | Refund all entry fees; prize pool refund via `refundPrizeToCreator`. |
| `refundPrizeToCreator(tournamentId)` | Owner | After cancel, return prize pool to creator. |
| `sweepTournamentResidualUSDC(tournamentId, to)` | Owner | After finalize, send that tournament’s recorded residual (e.g. to `TycoonRewardSystem`). |
| `recoverStrandedUSDC(to, amount)` | Owner | Pull USDC from escrow (e.g. mistaken transfer). Sweep residuals first when they apply. |

### View

- `tournaments(tournamentId)` — entryFee, prizePoolDeposited, totalEntryFees, status, creator.
- `entryPaid(tournamentId, player)` — amount user paid.
- `getEntrants(tournamentId)` — list of addresses who registered.
- `tournamentPool(tournamentId)` — total USDC (entry fees + prize pool). After finalize, pool fields are zeroed; unswept house cut remains in contract until `sweepTournamentResidualUSDC`.
- `pendingResidualUSDC(tournamentId)` — wei left after finalize for that tournament (owner sweeps to reward contract).

### Status Flow

`None` → `Open` (create) → `Locked` (lock) → `Finalized` (payouts) or `Cancelled` (refunds).

See **TOURNAMENT_ESCROW.md** for deployment and backend integration.

---

## Deployment & Setup

1. Deploy **TycoonToken** (or use existing TYC and USDC).
2. Deploy **TycoonRewardSystem**(tycToken, usdc, owner).
3. Deploy **Tycoon**(owner, rewardSystem).
4. Call `rewardSystem.setBackendMinter(address(tycoon))` so Tycoon can mint on register, AI end, and placement.
5. Call `tycoon.setBackendGameController(backendWallet)` for vote-out, setTurnCount, and property stats.
6. (Optional) `tycoon.setMinTurnsForPerks(20)` and `tycoon.setMinStake(...)`.
7. **Tournament escrow (Celo):** From `contract/`, run **`./run-deploy-tournament-escrow.sh`** (`--verify` with `ETHERSCAN_API_KEY`; **`--write-env`** appends addresses to `contract/.env` next to your upgradeable stack vars). Then **`./run-set-tournament-escrow-backend.sh`**: sets `setBackend` to the wallet derived from `BACKEND_GAME_CONTROLLER_PRIVATE_KEY` (tx signed with escrow owner `PRIVATE_KEY`). Copy the printed **`NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW`** into `frontend/.env`. Alternatively deploy via **`forge script script/DeployOptional.s.sol`** (deploys vault + registry + escrow + NFT together). `DRY_RUN=1` on `run-set-tournament-escrow-backend.sh` prints addresses only.
8. **TycoonUserRegistry (wallet-first signup):** Deploy and configure the user registry (smart wallets, wallet-first signup, buy/burn-with-auth). From `contract/` run:
   ```bash
   ./run-deploy-user-registry.sh
   ```
   Required in `.env`: `RPC_URL`, `PRIVATE_KEY`, `TYCOON_OWNER`, `TYCOON_PROXY_ADDRESS`, `TYCOON_REWARDS_FAUCET_ADDRESS`, `OPERATOR_ADDRESS`, `WITHDRAWAL_AUTHORITY_ADDRESS`. Optional: `TYCOON_NAIRA_VAULT_ADDRESS`, `TYCOON_REWARD_SYSTEM` (enables shop/burn for unlinked users), `DEFAULT_DAILY_CAP_USD6`, `DEFAULT_PRICE_CELO_USD6`. Copy `contract/.env.example` to `contract/.env` and fill values.

- **Redeploy registry (latest code) and add to game:** `./run-redeploy-user-registry.sh [--verify]`. Validates all required env vars and prints the new registry address for backend/frontend `.env`.
- **Add existing registry to game only:** If you already have a deployed registry and only need to point the proxy at it: set `TYCOON_USER_REGISTRY_ADDRESS` in `.env`, then `./run-set-user-registry-on-game.sh`.

---

## Backend Integration

- **When a player reaches the turn threshold (e.g. 20):** call `setTurnCount(gameId, playerAddress, 20)` once (as game controller).
- **When removing a player (vote-out / stall):** call `removePlayerFromGame(gameId, playerAddress, turnCount)` with turn count from your DB.
- **When a property is sold player-to-player:** call `transferPropertyOwnership(sellerUsername, buyerUsername)` (as game controller).

---

## Development

### Build

```bash
forge build
```

### Test

```bash
forge test
```

### Format

```bash
forge fmt
```

### Gas Snapshot

```bash
forge snapshot
```

### Local Node

```bash
anvil
```

### Deploy (example)

```bash
forge script script/Counter.s.sol:CounterScript --rpc-url <RPC_URL> --private-key <PK>
```

### Docs

- [Foundry Book](https://book.getfoundry.sh/)
- [Forge](https://book.getfoundry.sh/forge/), [Cast](https://book.getfoundry.sh/cast/), [Anvil](https://book.getfoundry.sh/anvil/)
