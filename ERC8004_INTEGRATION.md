# ERC-8004 Integration for Tycoon AI Players

This doc describes how Tycoon’s in-game AI players can get **verified on-chain identities** and **reputation** via [ERC-8004 (Trustless Agents)](https://eips.ethereum.org/EIPS/eip-8004) on Celo.

## Why ERC-8004?

Today, Tycoon AI players are synthetic addresses (`address(uint160(2))` … `address(uint160(8))`) with usernames like `AI_2`, `AI_3`, etc. They have no persistent identity or on-chain track record. ERC-8004 adds:

| Benefit | Description |
|--------|-------------|
| **Identity Registry (ERC-721)** | Each AI agent gets a unique token ID (`agentId`) and resolvable metadata (AgentURI). |
| **Reputation Registry** | Feedback (e.g. win/loss, strength) is stored on-chain so other players can see how an AI performs. |
| **Discoverability** | Agents can be listed in directories/marketplaces; players can choose AIs by reputation. |
| **Trust** | Players see an AI’s track record before playing. |

## Current vs ERC-8004 Flow

- **Current:** `createAIGame` creates a game with 1 human + N AIs; AIs are slots 2…(N+1) with addresses `address(uint160(i))` and usernames `AI_i`. When the game ends, only the human’s stats are updated; AIs have no cross-game identity or reputation.
- **With ERC-8004:** Each “personality” (slot 2–8) can be mapped to a registered **agentId** in the ERC-8004 Identity Registry. After each AI game, the **human player** (as client) can submit feedback to the Reputation Registry for each AI that was in the game. Over time, each agentId accumulates on-chain reputation (e.g. games played, win rate) that UIs and indexers can show.

## Architecture

### 1. Identity Registry (ERC-721)

- **Role:** One NFT per AI “personality”; token ID = `agentId`; token URI = AgentURI (metadata).
- **Celo deployments (reference):**
  - Mainnet Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - Testnet (e.g. Alfajores): confirm from [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts) or Celo docs.
- **Tycoon usage:** Protocol owner (or designated address) registers 7 agents (one per slot 2–8), e.g. “Tycoon AI 2” … “Tycoon AI 8”, with an AgentURI that describes the agent (name, description, image, `type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1"`). The contract stores `aiSlotToAgentId[slot] = agentId` so the game and frontend know which ERC-8004 agent each slot represents.

### 2. Reputation Registry

- **Role:** Stores feedback from “clients” (here: human players) about agents. Feedback includes `agentId`, `value`, `valueDecimals`, and optional `tag1`/`tag2` (e.g. `tag1 = "tycoon"`, `tag2 = "gameResult"`).
- **Celo deployments (reference):**
  - Mainnet Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- **Tycoon usage:** The **frontend** (with the human’s wallet) calls `giveFeedback(agentId, value, valueDecimals, "tycoon", "gameResult", "", "", bytes32(0))` after `endAIGame` (or `endAIGameAndClaim`) succeeds. The human is the feedback submitter; the contract does not need to call the Reputation Registry. Value can encode outcome (e.g. 100 = human lost to this AI / AI was strong, 0 = human beat this AI).

### 3. Slot ↔ Agent mapping in Tycoon

- **Contract (optional):**  
  - `erc8004IdentityRegistry` / `erc8004ReputationRegistry`: set by owner; `address(0)` = feature disabled.  
  - `aiSlotToAgentId[slot]`: slot 2–8 → Identity Registry `agentId`.  
  - View: `getAgentIdForAiSlot(slot)` and `getAgentIdForAiAddress(aiAddress)` (for `aiAddress` in 2..8).
- **Registration:** Owner (or script) calls Identity Registry `register(agentURI)` once per slot, then `setAIAgentId(slot, agentId)` in Tycoon.

## Data Flow

1. **Setup (one-time)**  
   - Deploy or use existing ERC-8004 registries on Celo.  
   - Owner sets Tycoon’s `erc8004IdentityRegistry` and `erc8004ReputationRegistry`.  
   - For each slot 2–8: register an agent (mint NFT), then call `setAIAgentId(slot, agentId)`.

2. **Create game**  
   - Unchanged: `createAIGame(...)` still creates AIs as `address(uint160(2))` … `address(uint160(1+numberOfAI))`.

3. **End game**  
   - Human calls `endAIGame(gameId, finalPosition, finalBalance, isWin)` (or existing “end and claim” wrapper).  
   - After the tx confirms, frontend (with same wallet) calls Reputation Registry `giveFeedback` for each AI in the game (slots 2…totalPlayers), using `getAgentIdForAiSlot(slot)` (or config) to get `agentId`. Feedback uses tags e.g. `tag1 = "tycoon"`, `tag2 = "gameResult"` and a value reflecting outcome.

4. **Discoverability**  
   - UIs/indexers can use Identity Registry (agent list, AgentURI) + Reputation Registry `getSummary(agentId, clientAddresses, "tycoon", "gameResult")` to show per-AI stats (games played, average rating, etc.) and link to agent profiles.

## AgentURI example (per slot)

Each registered Tycoon AI can use a registration file like:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Tycoon AI 2",
  "description": "Tycoon game AI opponent (slot 2). Play Monopoly-style games on Celo.",
  "image": "https://your-cdn.com/tycoon-ai-2.png",
  "services": [],
  "active": true,
  "registrations": [{ "agentId": "<id>", "agentRegistry": "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" }],
  "supportedTrust": ["reputation"]
}
```

Host the file at an HTTPS or IPFS URL and set that as the token’s `agentURI` in the Identity Registry.

## Security / design notes

- **Feedback submitter:** ERC-8004 expects the *client* (human player) to submit feedback. Tycoon does not call the Reputation Registry from the contract; the frontend calls it with the player’s wallet after end-game. That keeps “who gave feedback” clear and avoids the contract needing to be an agent owner.
- **Sybil:** Reputation can be gamed by many accounts. The spec suggests filtering by reviewer (e.g. `clientAddresses`) and building off-chain aggregation; we use `tag1 = "tycoon"` so Tycoon-specific reputation can be queried and weighted by your own logic (e.g. only count feedback from accounts with many games).
- **Optional:** If registries are not set in Tycoon, behavior is unchanged; no extra gas or dependency.

## Summary

- **Identity:** Each Tycoon AI slot (2–8) can map to one ERC-8004 agentId (ERC-721 NFT) on Celo, giving a persistent, discoverable identity.  
- **Reputation:** After each AI game, the human submits feedback to the Reputation Registry for each AI in that game, building on-chain reputation.  
- **Discoverability:** Third-party UIs and marketplaces can list Tycoon AIs and show their stats by reading the Identity + Reputation registries and Tycoon’s `aiSlotToAgentId` (or equivalent) mapping.
