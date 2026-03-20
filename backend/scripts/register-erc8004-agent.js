/**
 * One-time script: call ERC-8004 Identity Registry `register(agentURI)` on Celo (server wallet pays gas).
 *
 * IMPORTANT — user agents (My Agents):
 * The registrant wallet becomes on-chain ownerOf(agentId). For end users you should NOT use this
 * script: use the app (Register on Celo) so *their* wallet signs. If you register with this script
 * using a UserAgent’s public JSON URL, the JSON may list the user as `owner` but the NFT owner will
 * be the server key — inconsistent for trust / reputation.
 *
 * Good uses: one Tycoon-hosted AI identity (static AGENT_URI), ops/testing, or when you explicitly
 * want the server wallet to own the ERC-8004 NFT.
 *
 * Usage:
 *   AGENT_URI="https://your-domain.com/tycoon-ai.json" \
 *   CELO_RPC_URL="https://rpc.ankr.com/celo" \
 *   ERC8004_REGISTRANT_PRIVATE_KEY="0x..." \
 *   node scripts/register-erc8004-agent.js
 *
 * Or derive URI from your public API base + DB agent id (same caveat on ownership):
 *   TYCOON_PUBLIC_API_BASE="https://api.example.com" TYCOON_USER_AGENT_ID=42 \
 *   CELO_RPC_URL=... ERC8004_REGISTRANT_PRIVATE_KEY=0x... node -r dotenv/config scripts/register-erc8004-agent.js
 *   → AGENT_URI = {base}/api/agents/42/erc8004-registration
 *
 * Or use a .env in backend with these vars and: npm run register-erc8004-agent
 */

import { ethers } from "ethers";

const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const IDENTITY_REGISTRY_ABI = [
  "function register(string calldata agentURI) external returns (uint256 agentId)",
];

function resolveAgentUri() {
  const explicit = process.env.AGENT_URI?.trim();
  if (explicit) return explicit;
  const base = process.env.TYCOON_PUBLIC_API_BASE?.replace(/\/$/, "");
  const id = process.env.TYCOON_USER_AGENT_ID?.trim();
  if (base && id) {
    return `${base}/api/agents/${id}/erc8004-registration`;
  }
  return "https://base-monopoly.vercel.app/tycoon-ai.json";
}

async function main() {
  const agentUri = resolveAgentUri();
  const rpcUrl = process.env.CELO_RPC_URL || "https://rpc.ankr.com/celo";
  const privateKey =
    process.env.ERC8004_REGISTRANT_PRIVATE_KEY || process.env.BACKEND_GAME_CONTROLLER_PRIVATE_KEY;

  if (!agentUri) {
    console.error("Missing AGENT_URI. Set it to a public URL (or data URI) of your agent registration JSON.");
    process.exit(1);
  }
  if (!privateKey) {
    console.error(
      "Missing private key. Set ERC8004_REGISTRANT_PRIVATE_KEY or BACKEND_GAME_CONTROLLER_PRIVATE_KEY (Celo). Wallet needs CELO for gas."
    );
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, wallet);

  console.log("Registering agent on ERC-8004 Identity Registry (Celo)...");
  console.log("Agent URI:", agentUri);
  console.log("Registrant (owner of agent NFT):", wallet.address);

  const tx = await registry.register(agentUri);
  console.log("Tx hash:", tx.hash);
  const receipt = await tx.wait();
  if (!receipt) {
    console.error("Tx failed or no receipt");
    process.exit(1);
  }

  const iface = new ethers.Interface(IDENTITY_REGISTRY_ABI);
  const transferLog = receipt.logs?.find((l) => l.topics[0] === ethers.id("Transfer(address,address,uint256)"));
  let agentId = null;
  if (transferLog) {
    agentId = ethers.toBigInt(transferLog.topics[3]);
  }
  if (agentId == null) {
    const registerEvent = receipt.logs?.find((l) => l.address?.toLowerCase() === IDENTITY_REGISTRY_ADDRESS.toLowerCase());
    if (registerEvent) {
      try {
        const parsed = iface.parseLog({ topics: registerEvent.topics, data: registerEvent.data });
        if (parsed?.args?.length) agentId = parsed.args[0];
      } catch (_) {}
    }
  }
  if (agentId == null) {
    console.log("Tx confirmed. Could not parse agentId from logs; check the contract on Celo explorer.");
    process.exit(0);
  }

  console.log("\n✅ Agent registered!");
  console.log("agentId:", agentId.toString());
  console.log("\nIf this is the hosted Tycoon AI, add to frontend .env:");
  console.log("NEXT_PUBLIC_ERC8004_AGENT_ID=" + agentId.toString());
  console.log("And backend .env: ERC8004_AGENT_ID=" + agentId.toString());
  const uaId = process.env.TYCOON_USER_AGENT_ID?.trim();
  if (uaId) {
    console.log("\nIf linking UserAgent row " + uaId + " (server owns NFT — see script header):");
    console.log(
      "  PATCH /api/agents/" + uaId + "  body: { \"erc8004_agent_id\": \"" + agentId.toString() + "\" }"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
