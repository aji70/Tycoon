# 🎲 Tycoon — Monopoly Tycoon on Chain

## Overview

**Tycoon** is an exciting blockchain tycoon game inspired by the classic **Monopoly** board game, built on **Base**, **Stacks**, and **Celo**.  
Players can **buy, sell, and trade virtual properties**, collect rent, build monopolies, and compete in a **decentralized on-chain economy**.

This project combines **strategic gameplay** with **true ownership** and **transparent mechanics** using smart contracts.

> 🚧 Currently in active development — Frontend (React + Next.js) and smart contracts are being actively improved. Join the journey!

📖 **For a complete technical reference** of all game rules, formulas, and calculations, see [GAME_MECHANICS.md](./GAME_MECHANICS.md).

---

## How the game works

### Game modes

- **Play vs AI** — You play against AI opponents. Create a game from **Play with AI**, choose settings (e.g. number of AI players), then start. Your wallet must be **registered on-chain** before playing.
- **Play vs Humans (PvP)** — Multiplayer with real players. One person **creates a game** (game settings, entry stake, number of players) and gets a **6-character game code**. Others **join by code** (Join Room), enter the code, and are taken to the **waiting room**.

### Getting into a game

1. **Connect your wallet** (MetaMask, WalletConnect, etc.).
2. **Create or join a game**
   - **Create:** Go to game settings, set player count, entry stake (USDC), and options → create → you get a game code and waiting room link.
   - **Join:** Go to Join Room, enter the 6-character code → if the game is **PENDING**, you go to the waiting room; if **RUNNING** and you're already a player, you go straight to the board.
3. **Waiting room (PvP)**  
   - See who's in and how many slots are filled.  
   - **Pick your token** (e.g. 🚗🐶).  
   - If there's an **entry stake**, approve USDC and **Join** (on-chain join + backend).  
   - When all slots are filled, the game becomes **RUNNING** and everyone is taken to the game screen.

### Playing a turn

- **Turn order** is fixed (or random at start, depending on settings). The **current player** is indicated on the board/sidebar.
- **Roll the dice** — Only the current player can roll. You move that many spaces around the board.
- **Where you land:**
  - **Unowned property** — You may **buy** it (pay price to the bank) or **decline** (often leads to auction in some modes).
  - **Owned by someone else** — Pay **rent** (based on the property and any houses/hotels).
  - **Chance / Community Chest** — Draw a card; follow the effect (e.g. pay tax, move, get out of jail).
  - **Tax / Go to Jail / etc.** — Follow the space rule.
- **During your turn** you can **trade** with other players (or AI): propose or accept/counter offers (properties + cash). You can also **develop** (build), **mortgage**, or **unmortgage** your properties from the **Players** sidebar (My Empire, property actions).
- **End turn** when you're done; play passes to the next player.

### Money, bankruptcy & winning

- Everyone starts with **starting cash**. You earn by **passing Go**, **collecting rent**, and **selling/trading**. You spend by **buying properties**, **paying rent**, **taxes**, **development**, and **card effects**.
- If you **can't pay** what you owe (e.g. rent or tax), you can try to **raise cash** (mortgage, sell) or **declare bankruptcy**. When you go bankrupt, you're **out**; your assets go to the winner or the bank as per the rules.
- When only **one player** is left (everyone else bankrupt), that player **wins**. The **Victory** modal appears; the winner can **claim the prize** on-chain and the game is marked **FINISHED**.

### Summary flow

```
Connect wallet → (Register for AI) → Create or Join game
  → Waiting room (PvP: pick token, join with stake)
  → Game starts (RUNNING)
  → Take turns: Roll → Move → Buy / Pay rent / Card / etc. → Trade & property actions → End turn
  → Last player standing wins → Claim prize → Game over
```

---

## 🧾 Key contracts

| Detail | Info |
|--------|------|
| **Contract Base Address** | `0xc6c2ccc0cA40d700DE2e5696f2a5e71dd838A1c4` |
| **Contract Celo Address** | Set via `NEXT_PUBLIC_CELO` (see [Environment variables](#-environment-variables)) |
| **Contract Stacks Address** | `ST81CZF1YK81CPAMS6PRS3GJSKK35MGZ2VWEPSEN.tyc` |
| **Networks** | Base \| Celo \| Stacks |
| **Status** | ✅ Deployed — functionality under development |
| **ERC20 Base Address** | `0x8A867F46f1A0e8bA1AF573E83B26F86Aa23e07D3` |
| **ERC20 Celo Address** | Set via `NEXT_PUBLIC_CELO_TOKEN` (see below) |

---

## ⚙️ Environment variables

The frontend reads configuration from `.env.local`. **Never commit secrets**; use `.env.example` as a template and keep keys in `.env.local` (gitignored).

### API & backend

| Variable | Description | Example |
|----------|-------------|--------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL. For local dev use `http://localhost:3001/api`; for production use your deployed Railway (or other) URL. | `https://base-monopoly-production.up.railway.app/api` |

### Base chain (optional)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BASE` | Main Tycoon game contract on Base. |
| `NEXT_PUBLIC_BASE_REWARD` | Reward contract on Base. |
| `NEXT_PUBLIC_BASE_TOKEN` | TYC (or reward) token contract on Base. |
| `NEXT_PUBLIC_BASE_USDC` | USDC token contract on Base (entry stakes, payments). |

### Celo chain (main deployment)

These are the primary contract addresses used when the app runs on **Celo**. Set them in `frontend/.env.local`:

| Variable | Description | Example value |
|----------|-------------|---------------|
| `NEXT_PUBLIC_CELO` | **Main Tycoon game contract** on Celo. Handles game state, turns, properties, and on-chain logic. | `0xa40Cb493Cb72a8dcce28044b6CcfE63B8D90B914` |
| `NEXT_PUBLIC_CELO_TOKEN` | **TYC (Tycoon) ERC-20 token** on Celo. Used for in-game currency, rewards, and shop. Must be the token contract address, not the reward contract. | `0x7b1bef6B8d836FEb5d545D3a9F0D966a28A63259` |
| `NEXT_PUBLIC_CELO_REWARD` | **Reward contract** on Celo. Manages reward distribution and claims. | `0x18a9936b1cCc43096CB16450ff1Ee2ebc5Bce17d` |
| `NEXT_PUBLIC_CELO_USDC` | **USDC stablecoin** on Celo. Used for entry stakes, tournament fees, and real-money-denominated payments. | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| `NEXT_PUBLIC_CELO_AI_REGISTRY` | **AI agent registry** on Celo. Registers and resolves AI players for “Play vs AI” games (e.g. ERC-8004 or custom registry). | `0x73183cDD20fc3247686CFcF970A956a91561FAE2` |
| `NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS` | **Tournament escrow contract** on Celo. Holds entry fees and prize pool for PvP/tournament games; ensures funds are released according to game outcome. | `0xd1B710e781a8aF0b4D5facf0f35384ACFB5FDabE` |

**Note:** The frontend may reference `NEXT_PUBLIC_CELO_TYC` or `NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW` in code; ensure your `.env.local` keys match what `frontend/constants/contracts.ts` expects (e.g. alias `NEXT_PUBLIC_CELO_TOKEN` → TYC if required).

### Wallet & auth

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_PROJECT_ID` | WalletConnect / App Kit project ID (e.g. from WalletConnect Cloud). |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app ID for embedded wallet / social login. |
| `NEXT_PUBLIC_PRIVY_CLIENT_ID` | (Optional) Privy client ID if using dashboard app client. |

### AI & agents

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_ERC8004_AGENT_ID` | ERC-8004 Agent Trust Protocol: your registered AI agent ID on Celo (used for identity/reputation). |
| `ANTHROPIC_API_KEY` | Server-side only; used for AI opponent logic. Do **not** prefix with `NEXT_PUBLIC_`. |

### Observability

| Variable | Description |
|----------|-------------|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking (client and/or server). |

### NGN payments (Flutterwave) — backend only

To accept **Naira (NGN)** for perk bundles in the Shop, set these in the **backend** `.env` (see `backend/.env.example`):

| Variable | Description |
|----------|-------------|
| `FLW_SECRET_KEY` | Your Flutterwave secret key from [Dashboard](https://dashboard.flutterwave.com) → Settings → API Keys (use test key for development). |
| `FLW_SECRET_HASH` | Optional but recommended: webhook secret from Dashboard → Settings → Webhooks. Used to verify that webhook callbacks are from Flutterwave. |

Then in the Flutterwave dashboard, set your **Webhook URL** to `https://your-backend-url/api/shop/flutterwave/webhook`. After payment, users are redirected back to `/shop` and their bundle is fulfilled when the webhook is received.

### Minimal Celo `.env.local` snippet (addresses only)

```bash
# --- API ---
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app/api

# --- Celo contracts (from .env.local lines 12–20) ---
NEXT_PUBLIC_CELO=0xa40Cb493Cb72a8dcce28044b6CcfE63B8D90B914
NEXT_PUBLIC_CELO_TOKEN=0x7b1bef6B8d836FEb5d545D3a9F0D966a28A63259
NEXT_PUBLIC_CELO_REWARD=0x18a9936b1cCc43096CB16450ff1Ee2ebc5Bce17d
NEXT_PUBLIC_CELO_USDC=0xcebA9300f2b948710d2653dD7B07f33A8B32118C
NEXT_PUBLIC_CELO_AI_REGISTRY=0x73183cDD20fc3247686CFcF970A956a91561FAE2
NEXT_PUBLIC_CELO_TOURNAMENT_ESCROW_ADDRESS=0xd1B710e781a8aF0b4D5facf0f35384ACFB5FDabE
```

---

## ✨ Features (WIP)

- 🏡 **Property ownership** — Iconic Monopoly properties as ERC-721 NFTs  
- 💰 **Rent & tycoon mechanics** — Earn passive income; upgrade for higher yields  
- 🧾 **On-chain events** — Dice rolls, Chance, Community Chest, Tax, Jail  
- 📊 **Interactive dashboard** — Real-time board with rotatable cards (e.g. Income Tax $200, Luxury Tax $100)  
- ⛽ **Gas-efficient** — Leverages Base, Stacks, and Celo low fees  
- 👛 **Wallet integration** — MetaMask, WalletConnect ready  

---

## 🔮 Upcoming

- 👥 Multiplayer lobbies  
- 🏆 Leaderboards & tournaments  
- 🌾 Yield farming integrations  
- 🗳 DAO governance for expansions  

---

## 🛠 Tech stack

| Layer | Tools |
|-------|--------|
| **Frontend** | React, Next.js, Tailwind CSS |
| **Blockchain** | Solidity on Base, Stacks, Celo |
| **Interactions** | ethers.js / viem; Basescan, Celoscan |
| **UI** | Custom Monopoly board renderer (2D & 3D) |

**Live:** [tycoonworld.xyz](https://tycoonworld.xyz) · [base-monopoly.vercel.app](https://base-monopoly.vercel.app)

---

## 🗺 Roadmap

- ✅ Core smart contract deployment  
- ✅ Basic board UI (Chance, Community Chest, taxes)  
- ✅ NFT property minting  
- ✅ On-chain game logic (dice, turns)  
- ✅ UI/UX polish & mobile support  
- 🔍 Security audit & mainnet launch  
- 🏛 DAO & community governance  

---

## 🤝 Contributing

- Fork the repo and submit PRs (UI, cards, logic).  
- Report issues via GitHub.  
- Open to collaborations!

---

## 📬 Contact

- **Developer:** Sabo Ajidokwu Emmanuel / [@ajisabo2](https://twitter.com/ajisabo2)  
- **Support:** Email or Discord (TBD)  

---

## 🛡 License

MIT License — see [LICENSE](./LICENSE).

Built with ❤️ on Base, Stacks & Celo.  
*“Roll the dice. Build your empire.”*
