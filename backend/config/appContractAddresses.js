import { getChainConfig } from "./chains.js";

/** Celo mainnet only — admin contract monitor excludes Polygon, Base, Alfajores, USDC, and tournament escrow. */
const CELO_MAINNET_CHAIN_ID = 42220;

/** Default Celo mainnet TycoonGameFaucet — records property sales/transfers (recordPropertySale). */
const DEFAULT_PROPERTY_TRANSFER_REGISTRY =
  "0xB0F82D729ceEd0c5AEC0c958C6f7C2D8c5bb694D";

const EXCLUDED_LABELS = new Set(["Tournament escrow", "USDC token"]);

function normAddr(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null;
  return s;
}

function push(list, seen, entry) {
  if (entry.chainId !== CELO_MAINNET_CHAIN_ID) return;
  if (EXCLUDED_LABELS.has(entry.label)) return;

  const address = normAddr(entry.address);
  if (!address) return;
  const key = `${entry.chainId}:${address.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  list.push({
    label: entry.label,
    address,
    chain: entry.chain,
    chainId: entry.chainId,
    category: entry.category,
  });
}

/**
 * Celo mainnet contract addresses for the admin activity monitor.
 */
export function collectAppContractAddresses() {
  const list = [];
  const seen = new Set();
  const cfg = getChainConfig("CELO");
  const chainId = CELO_MAINNET_CHAIN_ID;

  const celoPairs = [
    { label: "Tycoon proxy", address: cfg.contractAddress, category: "core" },
    { label: "User registry", address: cfg.userRegistryAddress, category: "core" },
    {
      label: "Property transfer registry",
      address:
        cfg.gameFaucetAddress ||
        process.env.TYCOON_GAME_FAUCET_ADDRESS ||
        process.env.TYCOON_PROPERTY_TRANSFER_REGISTRY_ADDRESS ||
        DEFAULT_PROPERTY_TRANSFER_REGISTRY,
      category: "general",
    },
    { label: "Naira vault", address: cfg.nairaVaultAddress, category: "infrastructure" },
    { label: "TYC token", address: cfg.tycTokenAddress, category: "token" },
  ];

  for (const p of celoPairs) {
    push(list, seen, { ...p, chain: "CELO", chainId });
  }

  const globalPairs = [
    { label: "Reward system", address: process.env.REWARD_CONTRACT_ADDRESS || process.env.TYCOON_REWARD_SYSTEM, category: "core" },
    { label: "AI agent registry", address: process.env.TYCOON_AI_REGISTRY_ADDRESS || process.env.TYCOON_CELO_AI_REGISTRY || process.env.NEXT_PUBLIC_CELO_AI_REGISTRY, category: "core" },
    { label: "Smart wallet operator", address: process.env.SMART_WALLET_OPERATOR_ADDRESS || process.env.NEXT_PUBLIC_SMART_WALLET_OPERATOR_ADDRESS, category: "infrastructure" },
    { label: "Withdrawal authority", address: process.env.WITHDRAWAL_AUTHORITY_ADDRESS || process.env.NEXT_PUBLIC_WITHDRAWAL_AUTHORITY_ADDRESS, category: "infrastructure" },
    { label: "Swap executor", address: process.env.CELO_SWAP_EXECUTOR_ADDRESS || process.env.NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS, category: "infrastructure" },
    { label: "X402 pay-to", address: process.env.X402_PAY_TO_ADDRESS, category: "infrastructure" },
  ];

  for (const p of globalPairs) {
    push(list, seen, { ...p, chain: "CELO", chainId });
  }

  return list.sort((a, b) => a.label.localeCompare(b.label));
}
