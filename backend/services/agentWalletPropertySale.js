/**
 * Agent-owned wallet signs TycoonGameFaucet.recordPropertySaleByAgent on Celo.
 * Requires faucet upgrade + setAuthorizedAgentWriter(agentAddress, true) on mainnet.
 *
 * Keys: AI_PLAYER_{slot}_PRIVATE_KEY (slots 1–8), same addresses as frontend AI_ADDRESSES when generated via scripts/generate-ai-keys.js.
 */
import { JsonRpcProvider, Wallet, Contract, Network } from "ethers";
import { getChainConfig } from "../config/chains.js";
import logger from "../config/logger.js";

const CHAIN_NAMES = { CELO: "celo", POLYGON: "polygon", BASE: "base" };

const GAME_FAUCET_AGENT_ABI = [
  {
    type: "function",
    name: "recordPropertySaleByAgent",
    inputs: [
      { name: "sellerUsername", type: "string" },
      { name: "buyerUsername", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizedAgentWriters",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
];

const ONCHAIN_AGENT_GAME_TYPES = new Set([
  "ONCHAIN_AGENT_VS_AGENT",
  "ONCHAIN_AGENT_VS_AI",
  "ONCHAIN_HUMAN_VS_AGENT",
]);

export function isAgentSignedPropertySaleEnabled() {
  return process.env.ENABLE_AGENT_SIGNED_PROPERTY_SALE === "true";
}

export function shouldUseAgentWalletOnchain(game) {
  if (!game?.contract_game_id) return false;
  const gt = String(game.game_type || "");
  return ONCHAIN_AGENT_GAME_TYPES.has(gt);
}

function getPrivateKeyForSlot(slot) {
  const n = Number(slot);
  if (n >= 1 && n <= 8) {
    const perSlot = process.env[`AI_PLAYER_${n}_PRIVATE_KEY`];
    if (perSlot) return perSlot;
  }
  return process.env.AGENT_SIGNED_PROPERTY_SALE_PRIVATE_KEY || null;
}

function getAgentWalletContract(chain = "CELO") {
  const normalized = String(chain).toUpperCase();
  if (normalized !== "CELO") {
    throw new Error(`Agent-signed property sale is only implemented for CELO (got ${chain})`);
  }
  const { rpcUrl, chainId, gameFaucetAddress } = getChainConfig("CELO");
  if (!rpcUrl || !gameFaucetAddress) {
    throw new Error("CELO game faucet not configured (CELO_RPC_URL, TYCOON_GAME_FAUCET_ADDRESS)");
  }
  return { rpcUrl, chainId, gameFaucetAddress };
}

/**
 * @param {object} opts
 * @param {number} opts.slot - Turn order / agent slot (1–8)
 * @param {string} opts.buyerUsername - On-chain registered username (e.g. AI_2 or human username in arena)
 * @param {string} [opts.chain] - CELO only
 * @returns {Promise<{ hash: string, from: string }>}
 */
export async function recordPropertySaleByAgentWallet({
  slot,
  buyerUsername,
  chain = "CELO",
  sellerUsername = "Bank",
}) {
  const privateKey = getPrivateKeyForSlot(slot);
  if (!privateKey) {
    throw new Error(
      `No agent private key for slot ${slot} (set AI_PLAYER_${slot}_PRIVATE_KEY or AGENT_SIGNED_PROPERTY_SALE_PRIVATE_KEY)`
    );
  }
  const buyer = String(buyerUsername || "").trim();
  if (!buyer) throw new Error("buyerUsername required");

  const { rpcUrl, chainId, gameFaucetAddress } = getAgentWalletContract(chain);
  const networkName = CHAIN_NAMES.CELO;
  const network = new Network(networkName, chainId);
  const provider = new JsonRpcProvider(rpcUrl, network);
  const pk = String(privateKey).startsWith("0x") ? privateKey : `0x${privateKey}`;
  const wallet = new Wallet(pk, provider);

  const allowed = await new Contract(gameFaucetAddress, GAME_FAUCET_AGENT_ABI, provider).authorizedAgentWriters(
    wallet.address
  );
  if (!allowed) {
    throw new Error(
      `Agent wallet ${wallet.address} is not authorized on faucet ${gameFaucetAddress}. ` +
        `Run: node contract/scripts/authorize-agent-writers.js`
    );
  }

  const faucet = new Contract(gameFaucetAddress, GAME_FAUCET_AGENT_ABI, wallet);
  const tx = await faucet.recordPropertySaleByAgent(sellerUsername, buyer);
  const receipt = await tx.wait();
  logger.info(
    {
      hash: receipt?.hash,
      from: wallet.address,
      slot,
      sellerUsername,
      buyerUsername: buyer,
      chain: "CELO",
    },
    "Agent wallet recordPropertySaleByAgent tx"
  );
  return { hash: receipt?.hash, from: wallet.address };
}
