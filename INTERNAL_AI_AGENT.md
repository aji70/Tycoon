# Internal AI Agent (Human vs AI Games)

When a **human** starts an AI game, the opponent is no longer driven only by rule-based logic. The backend can use an **internal AI agent** that:

1. **Assesses** the game state (balance, properties, opponents, landed property, trades, etc.)
2. **Thinks** via an LLM (Claude) with Monopoly strategy prompts
3. **Decides** the next action (buy/skip, accept/decline trade, build/wait)

There is **one logical agent per game**: no separate process is spawned. The agent is invoked when the frontend (or backend) calls the existing **agent-registry decision API**; if no external agent is registered for that game/slot, the backend checks whether the game is an AI game and, if so, calls the internal agent.

## Flow

1. Human creates an AI game (e.g. 1 human + 1 AI). Game is stored with `is_ai: true`.
2. On each AI decision (property buy, trade response, building), the frontend calls `POST /api/agent-registry/decision` with `gameId`, `slot`, `decisionType`, and `context`.
3. **Backend** (`agentRegistry.getAIDecision`):
   - If a **registered external agent** exists for that game/slot → POST to its callback URL and use that response.
   - Else if the game is an **AI game** and the internal agent is enabled → call the internal agent (LLM) and return its decision.
   - Else → return `useBuiltIn: true` so the frontend uses the existing rule-based logic.

So the internal agent **replaces** the fixed computer rules for AI games when enabled; no code paths are removed, only the decision source changes.

## Backend

- **Service:** `backend/services/internalAgent.js`  
  Uses Anthropic SDK; builds prompts from context and returns `{ action, propertyId?, reasoning?, confidence? }` for `property`, `trade`, `building`, and `strategy`.
- **Registry:** `backend/services/agentRegistry.js`  
  After checking for an external agent, if none is found it loads the game, and if `game.is_ai` and `USE_INTERNAL_AI_AGENT` is not `"false"`, it calls `internalAgent.getDecision(...)` and returns that result.

## Configuration (backend)

In `.env` (see `backend/.env.example`):

| Variable | Purpose |
|----------|--------|
| `ANTHROPIC_API_KEY` | Required for the internal agent. If unset, the agent is disabled and built-in logic is used. |
| `USE_INTERNAL_AI_AGENT` | Set to `"false"` to disable the internal agent and always use built-in rules. Default: enabled. |
| `INTERNAL_AGENT_MODEL` | Optional. Default: `claude-sonnet-4-20250514`. |
| `INTERNAL_AGENT_TIMEOUT_MS` | Optional. Default: `15000`. |

## Frontend

- **Desktop:** `ai-board.tsx` calls the agent for **property buy** (after landing). `useAIAutoActions` calls the agent for **building** (then falls back to rule-based build if `useBuiltIn`).
- **Mobile:** `useMobileAiLogic.handleAiBuyDecision` calls the agent for **property buy** with the same fallback.
- **Trades:** Existing `useAiPlayerLogic` already called `/agent-registry/decision` for trades; with the internal agent enabled, AI games now get LLM-based trade decisions when no external agent is registered.

All decision types (`property`, `trade`, `building`, `strategy`) go through the same registry; the internal agent implements each type so that one agent per game handles every decision for that game’s AI slot(s).
