/**
 * ERC-8004 Reputation: submit giveFeedback on Celo using a backend wallet.
 * The contract disallows "self feedback" (the agent owner cannot submit feedback for their own agent).
 * Use ERC8004_FEEDBACK_PRIVATE_KEY for a wallet that is NOT the agent owner; otherwise feedback will fail.
 */

import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { getChainConfig } from "../config/chains.js";
import logger from "../config/logger.js";

const REPUTATION_REGISTRY_ABI = [
  "function giveFeedback(uint256 agentId, int128 value, uint8 valueDecimals, string calldata tag1, string calldata tag2, string calldata endpoint, string calldata feedbackURI, bytes32 feedbackHash) external",
];

const CELO_REPUTATION_ADDRESS =
  process.env.ERC8004_REPUTATION_REGISTRY_ADDRESS ||
  "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

/**
 * Submit one reputation feedback for the Tycoon AI agent on Celo.
 * Uses ERC8004_FEEDBACK_PRIVATE_KEY if set (must not be the agent owner, or you get "self feedback not allowed").
 * Otherwise uses Celo game controller key (will fail if that wallet registered the agent).
 * @param {bigint | number | string} agentId - ERC-8004 agent id (from registration)
 * @param {number} score - 0 = human won, 100 = AI won
 * @returns {Promise<{ success: boolean, hash?: string, error?: string }>}
 */
export async function submitErc8004Feedback(agentId, score) {
  const agentIdStr = String(agentId);
  if (!agentIdStr || agentIdStr === "0") {
    return { success: false, error: "ERC8004_AGENT_ID not set" };
  }

  const celoConfig = getChainConfig("CELO");
  const { rpcUrl, privateKey: controllerKey } = celoConfig;
  if (!celoConfig.isConfigured || !rpcUrl) {
    logger.debug("[erc8004Feedback] Celo not configured; skipping feedback");
    return { success: false, error: "Celo not configured" };
  }

  const privateKey = process.env.ERC8004_FEEDBACK_PRIVATE_KEY ?? controllerKey;
  if (!privateKey) {
    logger.debug("[erc8004Feedback] No wallet for feedback; set ERC8004_FEEDBACK_PRIVATE_KEY (must not be agent owner)");
    return { success: false, error: "No feedback wallet configured" };
  }

  const registryAddress = CELO_REPUTATION_ADDRESS;
  const provider = new JsonRpcProvider(rpcUrl);
  const pk = String(privateKey).startsWith("0x") ? privateKey : `0x${privateKey}`;
  const wallet = new Wallet(pk, provider);
  const contract = new Contract(registryAddress, REPUTATION_REGISTRY_ABI, wallet);

  const id = typeof agentId === "bigint" ? agentId : BigInt(agentIdStr);
  const value = Number(score);
  const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  try {
    const tx = await contract.giveFeedback(
      id,
      value,
      0,
      "tycoon",
      "gameResult",
      "",
      "",
      zeroHash
    );
    const receipt = await tx.wait();
    logger.info(
      { agentId: agentIdStr, score: value, hash: receipt?.hash },
      "[erc8004Feedback] Feedback submitted"
    );
    return { success: true, hash: receipt?.hash };
  } catch (err) {
    logger.warn({ err: err?.message, agentId: agentIdStr }, "[erc8004Feedback] Submit failed");
    return { success: false, error: err?.message || "Submit failed" };
  }
}
