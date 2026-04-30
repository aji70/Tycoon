/**
 * ERC-8004 Reputation: submit giveFeedback on Celo using a backend wallet.
 * The contract disallows "self feedback" (the agent owner cannot submit feedback for their own agent).
 * Use ERC8004_FEEDBACK_PRIVATE_KEY for a wallet that is NOT the agent owner; otherwise feedback will fail.
 *
 * 8004scan metrics (what we can/cannot populate):
 * - Stars: Use tag1="starred" for positive engagement (AI win, tip followed). Tycoon now submits this.
 * - Avg Feedback Score: From value (0–100). Tycoon submits gameResult and tipFollowed.
 * - "Overall Score" (UI): Explorer-specific composite; often includes service health (e.g. Web URL checks),
 *   not the same as average feedback — high feedback + avg score can still show Overall 0 until their formula is satisfied.
 * - Validations: Requires Validation Registry (zkML/TEE). Tycoon has no validation infra.
 * - Chats/Messages: From A2A/MCP protocol interactions. Tycoon is a board game, no chat endpoint.
 * - Watches: Platform-level (users following agent on 8004scan). Not controllable from backend.
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

/** On-chain giveFeedback `endpoint` (recommended by ERC-8004 feedback profile for attribution). */
const DEFAULT_FEEDBACK_ENDPOINT =
  process.env.ERC8004_FEEDBACK_ENDPOINT ||
  "https://base-monopoly-production.up.railway.app/api/agent-registry/decision";

/**
 * Submit one reputation feedback for the Tycoon AI agent on Celo.
 * Uses ERC8004_FEEDBACK_PRIVATE_KEY if set (must not be the agent owner, or you get "self feedback not allowed").
 * Otherwise uses Celo game controller key (will fail if that wallet registered the agent).
 * @param {bigint | number | string} agentId - ERC-8004 agent id (from registration)
 * @param {number} score - 0 = human won, 100 = AI won (gameResult); use 100 for other positive signals too — explorers render value as x/100.
 * @param {string} [tag2] - Optional tag2 for the feedback (default "gameResult"). Use "tipFollowed" when user followed an AI tip.
 * @param {string} [tag1] - Optional tag1 (default "tycoon"). Use "starred" for positive quality signals (ERC-8004 standard metric).
 * @returns {Promise<{ success: boolean, hash?: string, error?: string }>}
 */
export async function submitErc8004Feedback(agentId, score, tag2 = "gameResult", tag1 = "tycoon") {
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
  const endpoint = String(DEFAULT_FEEDBACK_ENDPOINT || "").trim();

  try {
    const tx = await contract.giveFeedback(
      id,
      value,
      0,
      tag1,
      tag2,
      endpoint,
      "",
      zeroHash
    );
    const receipt = await tx.wait();
    logger.info(
      { agentId: agentIdStr, score: value, tag1, tag2, hash: receipt?.hash },
      "[erc8004Feedback] Feedback submitted"
    );
    return { success: true, hash: receipt?.hash };
  } catch (err) {
    logger.warn({ err: err?.message, agentId: agentIdStr }, "[erc8004Feedback] Submit failed");
    return { success: false, error: err?.message || "Submit failed" };
  }
}
