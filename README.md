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
- **Agent vs Agent (Autonomous)** — Up to **8 agents** play against each other. The backend advances turns automatically (no browser required). Each seat maps to a **slot (1–8)** backed by a registered agent (callback URL or Tycoon-hosted agent).

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

## 🧾 Contract addresses

The game is **Celo-first**. Addresses are configured via environment variables in `frontend/.env.local` and `backend/.env` (see [Environment variables](#-environment-variables)). **Never put secrets in the README or in repo env examples.**

### Upgradable game contract

The **Tycoon game contract** is **upgradeable** (UUPS proxy). The app uses only the **proxy** address; the implementation can be upgraded by the contract owner without changing the proxy. Always point config at the proxy address, never at the implementation.

### Celo mainnet — reference addresses

| Contract | Purpose | Address (Celo mainnet) |
|----------|---------|------------------------|
| **Game contract (proxy)** | Create/join games, roll, properties, turns. Use this address in app config. | `0xA97fC9666a41cDAE3EFb74A4CaC87B9d33A16F0e` |
| **Reward contract** | TycoonRewardSystem — shop, vouchers, collectibles, perks. | `0x9728c4f405F8b4180dE56160Fb2F122F77C4C158` |
| **TYC token** | ERC-20 in-game currency and rewards. | `0x7b1bef6B8d836FEb5d545D3a9F0D966a28A63259` |
| **USDC** | Stablecoin for entry stakes and payments. | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| **AI agent registry** | Play vs AI — agent resolution. | `0x73183cDD20fc3247686CFcF970A956a91561FAE2` |
| **Tournament escrow** | Entry fees and prize pool for PvP/tournaments. | `0xd1B710e781a8aF0b4D5facf0f35384ACFB5FDabE` |
| **User registry** | Smart wallets per player (signup / wallet-first). | `0x0a8aBc9F54cd44b5449053Ad577514F3D2a854Fa` |
| **ERC-8004 reputation registry** | Optional; has a protocol default if not overridden. | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

Backend-only (no address in frontend): **Game faucet** (property-sale recording) — set in backend env if used for stats. **RPC URL** and **game controller key** are configured in backend env only; see `backend/.env.example`.

---

## ⚙️ Environment variables

The frontend reads configuration from `.env.local`. **Never commit secrets**; use `.env.example` as a template and keep keys in `.env.local` (gitignored).

### API & backend

| Purpose | Frontend env | Description |
|---------|--------------|-------------|
| Backend API base URL | (see `frontend/.env.example`) | For local dev use `http://localhost:3001/api`; for production use your deployed backend URL. Never commit production URLs with secrets. |

### Base chain (optional)

| Purpose | Frontend env | Description |
|---------|--------------|-------------|
| Game contract (Base) | (see `.env.example`) | Main Tycoon game contract on Base. |
| Reward contract (Base) | (see `.env.example`) | Reward contract on Base. |
| TYC token (Base) | (see `.env.example`) | TYC token contract on Base. |
| USDC (Base) | (see `.env.example`) | USDC on Base for entry stakes, payments. |

### Celo chain (main deployment)

Address values are in the [Contract addresses](#-contract-addresses) table above. Map them in `frontend/.env.local` using the keys expected by `frontend/constants/contracts.ts` (game proxy, reward, TYC token, USDC, AI registry, tournament escrow, user registry). Use the **proxy** for the game contract. Optional: ERC-8004 reputation registry and agent ID; see `frontend/.env.example` for exact variable names.

### Wallet & auth

| Purpose | Where | Description |
|---------|--------|-------------|
| WalletConnect / App Kit | Frontend env (see `.env.example`) | Project ID from WalletConnect Cloud. |
| Privy (embedded wallet, social login) | Frontend env (see `.env.example`) | App ID and optional client ID from Privy dashboard. |

Keep all auth and wallet keys in `.env.local`; never commit them.

### AI & agents

| Purpose | Where | Description |
|---------|--------|-------------|
| ERC-8004 agent ID (Celo) | Frontend env | Your registered AI agent ID for identity/reputation. |
| Internal AI opponent | Backend env only | Server-side key for AI opponent logic; never expose via a public env var. |

### Observability

| Purpose | Where | Description |
|---------|--------|-------------|
| Error tracking | Backend / frontend env (see `.env.example`) | Sentry DSN for client and/or server. |

### NGN payments (Flutterwave) — backend only

To accept **Naira (NGN)** for perk bundles in the Shop, set the Flutterwave secret key and optional webhook secret in **backend** `.env` (see `backend/.env.example`). Never commit these.

Then in the Flutterwave dashboard, set your **Webhook URL** to `https://your-backend-url/api/shop/flutterwave/webhook`. After payment, users are redirected back to `/shop` and their bundle is fulfilled when the webhook is received.

### Minimal Celo config (frontend)

See [Contract addresses](#-contract-addresses) for addresses. In `frontend/.env.local`, set your backend API URL and the Celo contract addresses (game **proxy**, reward, TYC token, USDC, AI registry, tournament escrow, user registry). Exact variable names are in `frontend/.env.example`; keep that file and `.env.local` out of version control and never commit secrets or production keys.

---

## ✨ What the game currently supports

### Chains & networks

- **Celo (main)** — Full stack: game contract, rewards, USDC, user registry, tournament escrow, AI registry. Mainnet (42220) and Alfajores testnet.
- **Base** — Game contract, reward, TYC token, USDC (addresses in env; frontend can be configured for Base).
- **Backend multi-chain** — Celo, Polygon, Base: each can have its own RPC, contract address, and game-controller key (`backend/config/chains.js`).

### Game modes

- **Play vs AI** — Create a game with AI opponents; your wallet must be registered on-chain. AI uses Tycoon-hosted agent (credits) or built-in rule-based logic when out of credits.
- **Play vs Humans (PvP)** — Create game (settings, entry stake in USDC, player count) → get 6-character code → others join by code → waiting room → pick token, pay stake if required → game starts when full.
- **Tournament / entry stakes** — USDC entry fees and prize pool via tournament escrow contract; winner claims on-chain.

### Board & UI

- **2D and 3D boards** — Desktop and mobile variants (`board-3d`, `board-3d-multi`, `board-3d-mobile`, `board-3d-multi-mobile`).
- **Real-time state** — Turn order, dice, positions, ownership, houses/hotels, jail, timers.
- **Property actions** — Buy, sell, trade, build houses/hotels, mortgage/unmortgage from sidebar (My Empire).

### Core mechanics (on-chain + backend)

- **Dice, move, rent** — Roll, move, pay rent (by property and development), pass Go ($200).
- **Chance & Community Chest** — Draw cards; effects (tax, move, get out of jail, etc.).
- **Jail** — Go to Jail, Visiting Jail; get out via roll doubles, pay, or Jail Free card.
- **Taxes** — Income Tax, Luxury Tax (fixed amounts).
- **Bankruptcy & winning** — Last player standing wins; time-based net-worth victory in AI mode; claim prize on-chain.
- **Trading** — Propose/accept/counter offers (properties + cash) with other players or AI.
- **Turn timer** — Configurable turn timeout; auto-skip or finish-by-time when applicable.

### AI & agents

- **“My agent plays for me”** — Use a Tycoon-hosted agent (from **My Agents** in the UI) that rolls, buys, builds, and uses perks on your behalf. Uses **credits** (daily free tier or purchased with USDC).
- **Built-in decisions** — When out of credits (or no hosted agent), the game uses rule-based logic: skip/buy, build on monopolies, etc. No error on board; credits shown on agents page.
- **Pre-roll flow** — Agent uses perks (e.g. Jail Free, Instant Cash, Lucky 7) → then build on monopolies → then roll.
- **ERC-8004** — Optional Agent Trust Protocol on Celo (identity/reputation); backend can submit feedback after AI games.
- **Internal AI (backend)** — Anthropic-based opponent for “Play vs AI” when configured in backend env.
- **Autonomous agent battles (backend runner)** — When `ENABLE_AGENT_GAME_RUNNER=true`, the backend can run **Agent vs Agent** matches without any connected clients.

### Perks & collectibles

- **Perks** — e.g. Jail Free (2), Instant Cash (5), Lucky 7 (13); usable by human or agent (pre-roll or when applicable).
- **Shop & bundles** — Perk bundles purchasable with TYC or NGN (Flutterwave); USDC for hosted agent credits.
- **Daily rewards / vouchers** — Via TycoonRewardSystem (reward contract).

### Auth & wallets

- **Privy** — Sign in with Privy (embedded wallet, social login); app ID in env.
- **WalletConnect** — MetaMask, App Kit (project ID in env).
- **Guest accounts** — Email/social sign-up; backend creates custodial/smart wallet and registers on-chain (user registry + game contract).
- **Smart wallets** — User registry creates TycoonUserWallet per player; operator/withdrawal authority for off-line withdrawals when configured.
- **Minipay** — Celo Mainnet (42220) supported for in-app wallet experience.

### Payments & economy

- **USDC** — Entry stakes (PvP), tournament fees, optional hosted agent credits ($1 = 100 credits).
- **TYC** — In-game token for shop, rewards, perks.
- **NGN (Naira)** — Flutterwave for perk bundles in the Shop (backend webhook); optional Paystack flow documented.
- **Tournament escrow** — Holds entry fees and prize pool; release on game outcome.

### Tech & observability

- **Gas-efficient** — Celo (and Base) low fees for transactions.
- **Sentry** — Optional client/server error tracking (configure in env; see observability in Environment variables).

---

## 🔮 Upcoming

- 👥 Deeper multiplayer lobbies & matchmaking  
- 🏆 Leaderboards & recurring tournaments  
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
