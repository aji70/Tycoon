# Tycoon Celo Agent

A small **Celo-backed AI agent** for [Tycoon](https://github.com/your-org/Tycoon) that implements the decision API expected by Tycoon's agent registry. Compatible with **Build Agents for the Real World** (Celo hackathon Feb 6–15, 2026) and **ERC-8004**.

- **Default:** Uses built-in rule-based logic (same style as Tycoon's in-app AI) so it works without API keys.
- **Optional:** Replace `src/decisionLogic.js` with Tycoon's `MonopolyAIDecisionEngine` (Claude) or your own LLM so the agent truly "represents" your AI without discarding Tycoon's functions.

## Quick start

```bash
npm install
npm start
```

**Next after the agent is running:**

1. **Start the Tycoon backend** (in another terminal), e.g. from repo root:
   ```bash
   cd backend && npm run dev
   ```
2. **Register this agent** with the backend (in a third terminal, from `tycoon-celo-agent/`):
   ```bash
   TYCOON_API_URL=http://localhost:3000 AGENT_SLOT=2 AGENT_CALLBACK_URL=http://localhost:4077 AGENT_ID=1 npm run register
   ```
   If the backend runs on another host/port, set `TYCOON_API_URL` and ensure `AGENT_CALLBACK_URL` is a URL the backend can reach (for local dev, `http://localhost:4077` is fine).
3. **Start the frontend** and create an AI game. When you send a **trade to AI_2**, the backend will call this agent for the decision; you should see the POST in the terminal where the agent is running.

Server listens on `PORT` (default 4077). Exposes `POST /decision` with body:

```json
{
  "requestId": "req_...",
  "gameId": 123,
  "slot": 2,
  "decisionType": "property" | "trade" | "building" | "strategy",
  "context": { "myBalance", "myProperties", "opponents", "landedProperty", "tradeOffer", ... },
  "deadline": "ISO date"
}
```

Response:

```json
{
  "requestId": "req_...",
  "action": "buy" | "skip" | "accept" | "decline" | "build" | "wait",
  "propertyId": 16,
  "reasoning": "Optional",
  "confidence": 0.85
}
```

## Register with Tycoon

Point Tycoon backend at this agent so it asks this service for decisions (fallback remains built-in logic when agent is down):

```bash
TYCOON_API_URL=http://localhost:3000 \
AGENT_SLOT=2 \
AGENT_CALLBACK_URL=http://localhost:4077 \
AGENT_ID=your-erc8004-agent-id \
npm run register
```

- **AGENT_ID:** Your ERC-8004 Identity Registry `agentId` (for Celo hackathon / 8004scan).
- **AGENT_CALLBACK_URL:** Public URL where Tycoon can POST (e.g. ngrok for local dev).

## Celo / ERC-8004

- Use [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Identity Registry on Celo for a verified agent identity.
- After games, humans can submit reputation feedback for your `agentId` (see Tycoon's `ERC8004_INTEGRATION.md`).
- Hackathon: [Build Agents for the Real World](https://celo.org) – register on Karma, verify with SelfClaw, tag @Celo and @CeloDevs.

## Architecture

See repo root **CELO_AGENT_INTEGRATION.md**: Tycoon keeps all existing AI logic; the agent is an **optional** decision source. When this agent is registered for a slot, Tycoon asks it first; on timeout or failure, Tycoon uses built-in functions unchanged.
