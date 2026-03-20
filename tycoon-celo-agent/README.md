# Tycoon Celo Agent

A small server that implements the decision API Tycoon expects (`POST /decision`). Uses **Claude (Anthropic)** for LLM-based decisions when `ANTHROPIC_API_KEY` is set; otherwise falls back to rule-based logic.

- **Main default in Tycoon:** The built-in rule-based logic (in the app) is the primary behavior — no API costs, no external service. That stays as-is.
- **This project:** Hybrid LLM + rules. Set `ANTHROPIC_API_KEY` for Claude-powered buy/skip, trade, and build decisions. On timeout or API failure, falls back to `src/decisionLogic.js` so the game never stalls. Compatible with **Build Agents for the Real World** (Celo hackathon) and **ERC-8004**.

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

### Option A: Use backend's internal agent (recommended — no separate process)

Register slots to use the backend's Claude (ANTHROPIC_API_KEY). Always online when the backend runs.

**One-time env in backend `.env`:**
```bash
TYCOON_INTERNAL_AGENT_SLOTS=2,3,4,5,6,7,8
ANTHROPIC_API_KEY=sk-ant-...
```

On backend startup, slots 2–8 are auto-registered. No `npm run register` needed.

**Or register a single slot manually:**
```bash
USE_INTERNAL_AGENT=true TYCOON_API_URL=http://localhost:3000 AGENT_SLOT=2 npm run register
```

### Option B: External agent (this server)

Run this agent as a separate process and point the backend at it:

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
