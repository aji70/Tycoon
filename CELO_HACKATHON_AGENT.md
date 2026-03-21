# Tycoon Agent — Build Agents for the Real World (Celo Hackathon V2)

**Hackathon:** [Build Agents for the Real World Celo Hackathon V2](https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9) (March 2–22, 2026)  
**Tycoon:** Monopoly-style on-chain game on Celo with AI agents that make real economic decisions.

---

## What We’ve Built

| Feature | Status | Notes |
|--------|--------|-------|
| **LLM decision layer** | ✅ | Claude (Anthropic) for buy/skip, trade, building, strategy. Uses `ANTHROPIC_API_KEY`. |
| **Hybrid fallback** | ✅ | On timeout or API failure, falls back to rule-based logic so the game never stalls. |
| **Backend-hosted agent** | ✅ | Agent runs inside the Tycoon backend. No separate process. Always online when backend runs. |
| **ERC-8004 identity** | ✅ | `ERC8004_AGENT_ID=187` in backend. Reputation feedback sent to agent 187 after each game. |
| **Agent vs Agent mode** | ✅ | Up to 8 agents play autonomously. Slots 2–8 auto-registered via `TYCOON_INTERNAL_AGENT_SLOTS`. |
| **Economic agency** | ✅ | Agents participate in a real game economy: USDC stakes, property trades, rent, monopolies. |
| **x402 pay-per-use** | ✅ | `POST /api/agent-registry/decision-paid` — agents pay per decision in cUSD on Celo. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Tycoon Backend                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  agentRegistry.getAIDecision(gameId, slot, type, ctx)    │   │
│  │                                                          │   │
│  │  1. Internal agent (useInternalAgent / TYCOON_INTERNAL)  │   │
│  │     → internalAgent.getDecision() → Claude API           │   │
│  │     → Fallback: built-in rules in agentGameRunner        │   │
│  │                                                          │   │
│  │  2. User agent (user_agent_id)                           │   │
│  │     → Tycoon-hosted or saved API key → Claude            │   │
│  │                                                          │   │
│  │  3. External callback (callbackUrl)                      │   │
│  │     → POST to tycoon-celo-agent or other service         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Env: ANTHROPIC_API_KEY, ERC8004_AGENT_ID, TYCOON_INTERNAL_*    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Setup (What You Need)

### Backend `.env`

```bash
# Required for LLM decisions
ANTHROPIC_API_KEY=sk-ant-...

# ERC-8004 agent identity (reputation feedback, agentscan)
ERC8004_AGENT_ID=187

# Optional: auto-register slots 2–8 to use backend's agent on startup
TYCOON_INTERNAL_AGENT_SLOTS=2,3,4,5,6,7,8
```

### Run

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

No separate agent process or `npm run register` required.

---

## Hackathon Submission Checklist

- [ ] **Karma** — Register project at [Karma](https://www.karmahq.xyz/community/celo?programId=1059)
- [ ] **Telegram** — Join [hackathon group](https://t.me/realworldagentshackathon)
- [ ] **Tweet** — Include:
  - Karma project link
  - agentscan Registry link (agent ID **187**)
  - Tag @Celo, @CeloDevs, @CeloPG
- [ ] **Submit** — Tweet + project link via [Karma form](https://app.karmahq.xyz/celo/programs/1059/apply)
- [ ] **Optional:** [agentscan.info](https://agentscan.info/) — Verify agent 187 appears
- [ ] **Optional:** [Self AI](https://app.ai.self.xyz/), [Molthunt](https://www.molthunt.com/)

---

## What We Could Still Do

Prioritized list of enhancements (from earlier discussion).

### 1. x402 Payment Flows — **Done**

- `POST /api/agent-registry/decision-paid` requires x402 payment (cUSD on Celo).
- Set `THIRDWEB_SECRET_KEY`, `X402_PAY_TO_ADDRESS` in backend `.env`.
- Optional: `X402_DECISION_PRICE` (default $0.01).

### 2. Celo Agent Skills — **Infra Track**

- Publish a [Celo agent skill](https://docs.celo.org/build-on-celo/build-with-ai/agent-skills) describing how to:
  - Create/join a Tycoon game
  - Interpret board state
  - Call the decision API
- Makes Tycoon composable infrastructure for other agents.
- **Scope:** Documentation + skill spec.

### 3. Mobile-First Agent UX

- Deep links, minimal agent dashboard (status, last decisions, agentId).
- Push-friendly summaries (“Your agent finished a turn”) for Agent vs Agent.
- **Scope:** Frontend + optional push service.

### 4. Safety & Fairness as a Feature

- Highlight existing behavior: timeouts, rate limits, deterministic fallbacks.
- Optional: logging/tracing for demos (requestId, slot, decisionType, latency).
- **Scope:** Docs + minor instrumentation.

### 5. External Agent Mode (tycoon-celo-agent)

- `tycoon-celo-agent` still supports external callback mode.
- Run it as a separate service and register with `AGENT_CALLBACK_URL` for custom hosting or multi-tenant setups.
- **Scope:** Already implemented; useful for advanced deployments.

---

## x402 Paid Endpoint

**`POST /api/agent-registry/decision-paid`**

Same body as `/decision`: `{ gameId, slot, decisionType, context }`.

- **Without payment:** Returns `402 Payment Required` with x402 headers.
- **With payment:** Client sends `PAYMENT-SIGNATURE` or `X-PAYMENT` header after signing; returns decision.
- **Price:** $0.01 per decision (configurable via `X402_DECISION_PRICE`).
- **Chain:** Celo (USDC/cUSD).

Backend `.env`:
```bash
THIRDWEB_SECRET_KEY=...    # From thirdweb dashboard
X402_PAY_TO_ADDRESS=0x...  # Receives payments
X402_DECISION_PRICE=$0.01  # Optional
```

---

## Key Files

| File | Purpose |
| `backend/services/internalAgent.js` | Claude-based decision logic (prompts, parsing, validation) |
| `backend/services/agentRegistry.js` | Slot registration, internal vs external routing, auto-register |
| `backend/services/x402Service.js` | x402 payment settlement for pay-per-use decisions |
| `backend/routes/agent-registry.js` | `/decision`, `/hosted/:id/decision`, action-feedback |
| `tycoon-celo-agent/` | Optional external agent server (LLM + rules) |
| `backend/.env` | `ANTHROPIC_API_KEY`, `ERC8004_AGENT_ID`, `TYCOON_INTERNAL_AGENT_SLOTS` |

---

## Resources

- [Hackathon Brief](https://celoplatform.notion.site/Build-Agents-for-the-Real-World-Celo-Hackathon-V2-2fdd5cb803de80c99010c04b6902a3a9)
- [ERC-8004 Agent Wallet Standard](https://eips.ethereum.org/EIPS/eip-8004)
- [x402 Payment Protocol (Thirdweb)](https://portal.thirdweb.com/x402)
- [Celo Agent Skills](https://docs.celo.org/build-on-celo/build-with-ai/agent-skills)
- [agentscan](https://agentscan.info/)
