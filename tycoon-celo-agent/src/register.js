/**
 * Register this agent with Tycoon backend so the game uses this agent for the given slot.
 * Requires: TYCOON_API_URL, AGENT_SLOT, AGENT_CALLBACK_URL, AGENT_ID (ERC-8004 agentId)
 *
 * Example:
 *   TYCOON_API_URL=http://localhost:3000 AGENT_SLOT=2 AGENT_CALLBACK_URL=http://host:4077/ AGENT_ID=1 node src/register.js
 */

const base = process.env.TYCOON_API_URL || "http://localhost:3000";
const slot = process.env.AGENT_SLOT || "2";
const callbackUrl = process.env.AGENT_CALLBACK_URL || `http://localhost:4077`;
const agentId = process.env.AGENT_ID || "tycoon-celo-agent-1";
const chainId = process.env.CELO_CHAIN_ID || "42220";
const name = process.env.AGENT_NAME || "Tycoon Celo Agent";

async function register() {
  const url = `${base.replace(/\/$/, "")}/api/agent-registry/register`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slot: Number(slot),
      agentId,
      callbackUrl: callbackUrl.replace(/\/$/, ""),
      chainId: Number(chainId),
      name,
    }),
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
