# Celo Agent Integration for Tycoon AI

This document describes how to integrate **Celo agentic AI** (ERC-8004, Build Agents for the Real World hackathon) so external agents can *represent* Tycoon’s in-game AI—**without discarding** existing built-in AI logic. Built-in functions remain the default; agents are an optional overlay.

## Reference: PokerBot on Monad

In **PokerBot-main** (Monad), the flow is:

| Component | Role |
|-----------|------|
| **Agent** (standalone process) | Registers with Coordinator via WebSocket; receives `create_game_command` / `join_game_command`; uses StrategyEngine for decisions; signs and sends on-chain actions via ContractClient. |
| **Coordinator** | Matchmaking, relays agent thoughts to frontend, sends game commands to agents. |
| **Frontend** | Subscribes to games, displays agent thoughts and table state. |
| **Contracts** | Hold game state and funds on Monad. |

Agents are **the** players: they own wallets, create/join games on-chain, and take actions. There is no “built-in AI”; the only AI is the agent process.

## Tycoon Today vs Goal

**Tycoon today:**

- **Built-in AI:** Frontend runs AI turns (strategy, roll, buy, build) using in-app logic and optionally `MonopolyAIDecisionEngine` (Claude) in `frontend/lib/ai-agent/`. Backend exposes game APIs (change-position, buy, development, end-turn, trade accept/decline). No separate agent process.
- **ERC-8004 (existing doc):** Identity and reputation on Celo: slot → `agentId`, post-game feedback. See `ERC8004_INTEGRATION.md`.

**Goal:** Let a **Celo agent** (ERC-8004 identity, optionally running as a separate service) act as the “brain” for one or more AI slots—while **keeping all current Tycoon functions** as the fallback when no agent is connected or the agent times out.

## Architecture: Agent as Optional Decision Source

- **Existing functions stay.** All current AI behavior (trade favorability, buy/skip, build, strategy, roll) remains in place.
- **Agent = optional decision source.** For a given game/slot we can attach an “agent backend” (ERC-8004 `agentId` + endpoint or WebSocket). When it’s that AI’s turn:
  1. If the slot has a registered Celo agent → ask the agent for the decision (with game context).
  2. If the agent responds in time → use that decision and execute it via **existing** backend APIs.
  3. If no agent, agent unreachable, or timeout → use **existing** built-in logic (same as today).

So the agent “represents” the AI only when it is registered and responsive; otherwise Tycoon behaves exactly as it does now.

## Components

### 1. Agent Registry (backend)

- **Storage:** Map “which AI slot (or game+slot) is backed by which agent”.
- **Fields per registration:** e.g. `agentId` (ERC-8004), `callbackUrl` or WebSocket id, optional `chainId` (Celo = 42220 / Alfajores = 44787).
- **APIs:** Register/unregister agent for a slot (or for “any game” with that slot). List registered agents.

No change to game creation: `createAIGame` and existing flows stay. Registry only says “when this slot needs a decision, try this agent first.”

### 2. Decision Adapter (backend)

- **Single entry point:** e.g. `getAIDecision(gameId, slot, decisionType, context)`.
- **Behavior:**
  - If slot has a registered agent with endpoint → HTTP POST (or WebSocket) to agent with `decisionType` and `context`; parse response; return decision.
  - If no agent or request fails/timeout → return `null`.
- **Callers:** Any code that currently “decides” for the AI (e.g. turn handler, trade handler) calls `getAIDecision` first. If result is non-null, use it and call **existing** backend APIs (buy, accept trade, etc.). If null, use **existing** built-in logic (e.g. `calculateAiFavorability`, `MonopolyAIDecisionEngine`, rule-based buy/build).

So existing functions are never removed; they are the fallback.

### 3. Decision Request/Response Shape

So that both Tycoon and Celo agents speak the same language:

**Request (Tycoon → Agent):**

```json
{
  "requestId": "uuid",
  "gameId": 123,
  "slot": 2,
  "decisionType": "property" | "trade" | "building" | "strategy",
  "context": {
    "myBalance": 1500,
    "myPosition": 16,
    "myProperties": [...],
    "opponents": [...],
    "landedProperty": { "id": 16, "name": "Oriental Ave", "price": 100, ... },
    "tradeOffer": { ... },
    "gameState": { ... }
  },
  "deadline": "2026-02-15T12:00:00Z"
}
```

**Response (Agent → Tycoon):**

```json
{
  "requestId": "uuid",
  "action": "buy" | "skip" | "accept" | "decline" | "build" | "wait",
  "propertyId": 16,
  "reasoning": "Optional short explanation",
  "confidence": 0.85
}
```

Agents can return only the fields relevant to the `decisionType`. Tycoon then executes via existing routes (e.g. buy, accept/decline, development).

### 4. Celo Agent Package (for hackathon builders)

A small **Tycoon Celo Agent** package (e.g. `packages/tycoon-celo-agent` or repo in Celo ecosystem) that:

- **Registers** with Tycoon backend: ERC-8004 `agentId`, Celo chain, callback URL (or WebSocket).
- **Receives** decision requests (HTTP POST or WebSocket) with the shape above.
- **Computes** decision:
  - **Default:** Use Tycoon’s existing logic (e.g. import or reimplement `MonopolyAIDecisionEngine` / rule-based helpers) so the agent “wraps” our functions.
  - **Optional:** Replace with custom logic (LLM, different strategy) and still return the same response shape.
- **Returns** the JSON response above.

So “without discarding our functions” is satisfied in two ways: (1) Tycoon always falls back to built-in logic when the agent is absent or fails; (2) the reference Celo agent can itself use Tycoon’s decision engine.

### 5. ERC-8004 and Celo

- **Identity:** Use existing ERC-8004 Identity Registry on Celo (see `ERC8004_INTEGRATION.md`). Each Celo agent that backs a Tycoon AI slot should have an `agentId`; register in our registry with that `agentId`.
- **Reputation:** After a game, human player can submit feedback to the Reputation Registry for each `agentId` that was in the game (unchanged from `ERC8004_INTEGRATION.md`).
- **Hackathon:** Build Agents for the Real World on Celo (Feb 6–15, 2026): agents get verified identity (ERC-8004), can use x402/celo/skills; Tycoon can list “Celo-backed AI” in the UI and link to 8004scan.io.

## Data Flow (with agent)

1. Game created as today (e.g. `createAIGame`). Optionally, frontend or backend marks “slot 2 = Celo agent” (e.g. `agentId` from 8004).
2. When it’s slot 2’s turn (or trade targeting slot 2):
   - Backend (or frontend calling backend) calls `getAIDecision(gameId, 2, decisionType, context)`.
   - Adapter looks up slot 2 → agent endpoint; if present, POSTs request to agent.
   - Agent responds with `action` (and optional fields).
   - If response valid and in time: backend runs **existing** API (e.g. buy, accept, build). If no agent or timeout: use **existing** built-in logic.
3. Rest of game (roll, move, end turn, etc.) unchanged; only the “decision” step is optionally delegated to the agent.

## Summary

| Concern | Approach |
|--------|----------|
| Don’t discard existing functions | They remain; used whenever no agent is registered or agent fails/timeout. |
| Agent represents AI | When registered, agent is asked first for decisions; its response is executed via current APIs. |
| Celo / ERC-8004 | Use existing Identity + Reputation; agent registry stores `agentId` and endpoint; compatible with Celo hackathon and 8004scan. |
| PokerBot-style “agent process” | Optional: run a Tycoon Celo Agent that implements the decision API and can use our decision-engine or its own. |

Next steps: implement Agent Registry + `getAIDecision` adapter in backend, add minimal Celo agent package that uses existing decision-engine by default, then wire one decision path (e.g. property buy) to use the adapter with fallback to current logic.
