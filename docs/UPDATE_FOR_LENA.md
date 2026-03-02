# Tycoon Product Update for Lena

**From:** Celo team  
**Date:** March 2025

---

Hi Lena,

Trust you’re well.

Here’s a short update on where Tycoon stands and what we’ve shipped recently.

---

## Product highlights

### Claude AI integration (Anthropic SDK)

We’ve integrated **Claude** via the **Anthropic SDK** so that AI is central to the experience:

- **AI vs human games**  
  In single-player (human vs AI) games, the AI opponent is no longer rule-based only. Claude evaluates the game state (balance, properties, trades, etc.) and decides actions: buy/skip on properties, accept/decline trades, and when to build. One AI agent per game, invoked through our agent-registry API.

- **In-game tips for players**  
  When players are in a game (including multiplayer), they can get **contextual tips** from the same AI—e.g. whether to buy a property they’ve landed on. Tips are optional and can be toggled on/off, so the experience stays under the player’s control.

All of this is powered by our internal agent service using the Anthropic SDK, with configurable model and timeouts. We also have a **Celo ERC-8004 agent** registered in the ecosystem; its ID is **187**.

### Gasless interactions

We’ve made interactions **gasless** (or gas‑sponsored) so that joining, playing, and performing in-game actions don’t require users to pay gas. This keeps onboarding and day‑to‑day play smooth and accessible.

### Fully 3D board

The game board is **fully 3D**: dice, tokens, and properties are rendered in 3D on both desktop and mobile, with a consistent experience across play modes (AI games and multiplayer).

---

## Recent UX and stability improvements

- **Rooms & chat**  
  - **“Rooms”** is now in the main nav. It takes players to a **general lobby** where they can see who’s online and use the **general chat**.  
  - **In-game chat** (Tavern) is only shown inside a game, so it’s clear when you’re chatting in the room vs in a specific match.

- **Chat behaviour**  
  - In the general lobby (Rooms), **your messages** are clearly aligned (e.g. on the right) vs others (on the left), so the thread is easy to follow.  
  - **In-game (Tavern) chat** no longer blinks or flickers when new messages load; the list stays stable while polling in the background.

- **Mobile**  
  - On the **mobile lobby** (Rooms), we removed the scroll‑to‑top button to reduce clutter and keep the focus on the lobby and chat.

---

We’re happy to walk through any of this in a call or to share a build when useful.

Best,  
Celo team
