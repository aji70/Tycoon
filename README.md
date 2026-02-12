# 🎲 Tycoon — Monopoly Tycoon on Chain

## Overview

**Tycoon** is an exciting blockchain tycoon game inspired by the classic **Monopoly** board game, built on **Base, Stacks and Celo**.  
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
   - **Join:** Go to Join Room, enter the 6-character code → if the game is **PENDING**, you go to the waiting room; if **RUNNING** and you’re already a player, you go straight to the board.
3. **Waiting room (PvP)**  
   - See who’s in and how many slots are filled.  
   - **Pick your token** (e.g. 🚗🐶).  
   - If there’s an **entry stake**, approve USDC and **Join** (on-chain join + backend).  
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
- **End turn** when you’re done; play passes to the next player.

### Money, bankruptcy & winning

- Everyone starts with **starting cash**. You earn by **passing Go**, **collecting rent**, and **selling/trading**. You spend by **buying properties**, **paying rent**, **taxes**, **development**, and **card effects**.
- If you **can’t pay** what you owe (e.g. rent or tax), you can try to **raise cash** (mortgage, sell) or **declare bankruptcy**. When you go bankrupt, you’re **out**; your assets go to the winner or the bank as per the rules.
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

## 🧾 Key Contract

| Detail          | Info |
|-----------------|------|
| **Contract Base Address** | `0xc6c2ccc0cA40d700DE2e5696f2a5e71dd838A1c4` |
| **Contract Celo Address** | `0x7cd34f84Cf5c389C34FE9525b812A041e2299594` |
| **Contract Stacks  Address** | `ST81CZF1YK81CPAMS6PRS3GJSKK35MGZ2VWEPSEN.tyc` |
| **Network**     | Base | Celo | Stacks|
| **Status**      | ✅ Deployed — Functionality under development |
| **ERC20 Base Address** | `0x8A867F46f1A0e8bA1AF573E83B26F86Aa23e07D3` |
| **ERC20 Celo Address** | `0x40C7c0c9277d8ACF7bCe32ed33e37865f5Ed3310` |


---

## ✨ Features (WIP)

- 🏡 **Property Ownership** — Iconic Monopoly properties as ERC-721 NFTs  
- 💰 **Rent & Tycoon Mechanics** — Earn passive income; upgrade for higher yields  
- 🧾 **On-Chain Events** — Dice rolls, Chance, Community Chest, Tax, Jail  
- 📊 **Interactive Dashboard** — Real-time board with rotatable cards (e.g., Income Tax $200, Luxury Tax $100)  
- ⛽ **Gas Efficient** — Leverages Base, Stacks and Celo’s low fees  
- 👛 **Wallet Integration** — MetaMask, WalletConnect ready  

---

## 🔮 Upcoming

- 👥 Multiplayer Lobbies  
- 🏆 Leaderboards & Tournaments  
- 🌾 Yield Farming Integrations  
- 🗳 DAO Governance for Expansions  

---

## 🛠 Tech Stack

| Layer      | Tools |
|------------|------|
| **Frontend** | React, Next.js, Tailwind CSS |
| **Blockchain** | Solidity on Base, Stacks and Celo |
| **Interactions** | ethers.js, Basescan celoscan|
| **UI Components** | Custom Monopoly board renderer |

Visit:  https://base-monopoly.vercel.app tycoonworld.xyz|| https://base-monopoly.vercel.app
🗺 Roadmap

✅ Core Smart Contract Deployment

🎨 Basic Board UI (Chance, Community Chest, Taxes)

🪙 NFT Property Minting

🎲 On-Chain Game Logic (Dice, Turns)

📱 UI/UX Polish & Mobile Support

🔍 Security Audit & Mainnet Launch

🏛 DAO & Community Governance

🤝 Contributing

Fork & submit PRs (UI/cards/logic)

Report issues via GitHub

Open to collaborations!

📬 Contact

Developer: Sabo Ajidokwu Emmanuel / @ajisabo2

Support: Email or Discord (TBD)

🛡 License
MIT License — See LICENSE file.

Built with ❤️ on Base
“Roll the dice. Build your empire.”
