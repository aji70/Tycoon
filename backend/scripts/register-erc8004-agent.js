/**
 * One-time script: register Tycoon AI as an agent on ERC-8004 Identity Registry (Celo).
 * Run once to get an agentId, then set NEXT_PUBLIC_ERC8004_AGENT_ID in the frontend.
 *
 * Usage:
 *   AGENT_URI="https://your-domain.com/tycoon-ai.json" \
 *   CELO_RPC_URL="https://rpc.ankr.com/celo" \
 *   ERC8004_REGISTRANT_PRIVATE_KEY="0x..." \
 *   node scripts/register-erc8004-agent.js
 *
 * Or use a .env in backend with these vars and: node -r dotenv/config scripts/register-erc8004-agent.js
 */

import { ethers } from "ethers";

const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const IDENTITY_REGISTRY_ABI = [
  "function register(string calldata agentURI) external returns (uint256 agentId)",
];

async function main() {
  const agentUri =
    process.env.AGENT_URI || "https://base-monopoly.vercel.app/tycoon-ai.json";
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
  console.log("\nAdd to your frontend .env.local:");
  console.log("NEXT_PUBLIC_ERC8004_AGENT_ID=" + agentId.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
