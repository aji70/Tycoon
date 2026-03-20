/**
 * Register this agent with Tycoon backend so the game uses this agent for the given slot.
 *
 * Mode 1 (internal): USE_INTERNAL_AGENT=true — uses backend's Claude (ANTHROPIC_API_KEY).
 *   No separate agent process. Always online when backend runs.
 *   Example: USE_INTERNAL_AGENT=true TYCOON_API_URL=http://localhost:3000 AGENT_SLOT=2 npm run register
 *
 * Mode 2 (external): Provide AGENT_CALLBACK_URL for tycoon-celo-agent's own server.
 *   Example: TYCOON_API_URL=http://localhost:3000 AGENT_SLOT=2 AGENT_CALLBACK_URL=http://host:4077 AGENT_ID=1 npm run register
 */

const base = process.env.TYCOON_API_URL || "http://localhost:3000";
const slot = process.env.AGENT_SLOT || "2";
const useInternal = process.env.USE_INTERNAL_AGENT === "true" || process.env.USE_INTERNAL_AGENT === "1";
const callbackUrl = process.env.AGENT_CALLBACK_URL || `http://localhost:4077`;
const agentId = process.env.AGENT_ID || "tycoon-celo-agent-1";
const chainId = process.env.CELO_CHAIN_ID || "42220";
const name = process.env.AGENT_NAME || "Tycoon Celo Agent";

async function register() {
  const url = `${base.replace(/\/$/, "")}/api/agent-registry/register`;
  const body = {
    slot: Number(slot),
    agentId,
    chainId: Number(chainId),
    name,
  };
  if (useInternal) {
    body.useInternalAgent = true;
  } else {
    body.callbackUrl = callbackUrl.replace(/\/$/, "");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.success) {
    console.log("Registered:", data);
  } else {
    console.error("Registration failed:", res.status, data);
    process.exit(1);
  }
}

register();
