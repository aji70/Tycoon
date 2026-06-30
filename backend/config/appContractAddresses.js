import { getChainConfig, SUPPORTED_CHAINS } from "./chains.js";

function normAddr(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return null;
  return s;
}

function push(list, seen, entry) {
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

const CHAIN_LABELS = { CELO: "Celo", POLYGON: "Polygon", BASE: "Base" };

/**
 * All on-chain addresses configured in backend env (and a few shared fallbacks).
 * Used by admin contract activity monitor.
 */
export function collectAppContractAddresses() {
  const list = [];
  const seen = new Set();

  for (const chain of SUPPORTED_CHAINS) {
    const cfg = getChainConfig(chain);
    const chainLabel = CHAIN_LABELS[chain] || chain;
    const chainId = cfg.chainId || 0;
    if (!chainId) continue;

    const pairs = [
      { label: "Tycoon proxy", address: cfg.contractAddress, category: "core" },
      { label: "Tournament escrow", address: cfg.tournamentEscrowAddress, category: "core" },
      { label: "User registry", address: cfg.userRegistryAddress, category: "core" },
      { label: "Game faucet", address: cfg.gameFaucetAddress, category: "core" },
      { label: "Naira vault", address: cfg.nairaVaultAddress, category: "infrastructure" },
      { label: "USDC token", address: cfg.usdcAddress, category: "token" },
      { label: "TYC token", address: cfg.tycTokenAddress, category: "token" },
      { label: "DashRunner", address: cfg.dashRunnerContractAddress, category: "infrastructure" },
    ];

    for (const p of pairs) {
      push(list, seen, { ...p, chain, chainId });
    }
  }

  const globalPairs = [
    { label: "Reward system", address: process.env.REWARD_CONTRACT_ADDRESS || process.env.TYCOON_REWARD_SYSTEM, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "core" },
    { label: "AI agent registry", address: process.env.TYCOON_AI_REGISTRY_ADDRESS || process.env.TYCOON_CELO_AI_REGISTRY || process.env.NEXT_PUBLIC_CELO_AI_REGISTRY, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "core" },
    { label: "Smart wallet operator", address: process.env.SMART_WALLET_OPERATOR_ADDRESS || process.env.NEXT_PUBLIC_SMART_WALLET_OPERATOR_ADDRESS, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "infrastructure" },
    { label: "Withdrawal authority", address: process.env.WITHDRAWAL_AUTHORITY_ADDRESS || process.env.NEXT_PUBLIC_WITHDRAWAL_AUTHORITY_ADDRESS, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "infrastructure" },
    { label: "Swap executor", address: process.env.CELO_SWAP_EXECUTOR_ADDRESS || process.env.NEXT_PUBLIC_CELO_SWAP_EXECUTOR_ADDRESS, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "infrastructure" },
    { label: "X402 pay-to", address: process.env.X402_PAY_TO_ADDRESS, chain: "CELO", chainId: Number(process.env.CELO_CHAIN_ID) || 42220, category: "infrastructure" },
    { label: "ERC-8004 reputation registry", address: process.env.ERC8004_REPUTATION_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_ERC8004_REPUTATION || "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", chain: "CELO", chainId: 42220, category: "erc8004" },
    { label: "ERC-8004 identity registry (mainnet)", address: process.env.ERC8004_IDENTITY_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_ERC8004_IDENTITY || "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", chain: "CELO", chainId: 42220, category: "erc8004" },
    { label: "ERC-8004 identity registry (Alfajores)", address: process.env.ERC8004_IDENTITY_REGISTRY_ADDRESS_ALFAJORES || process.env.NEXT_PUBLIC_ERC8004_IDENTITY_ALFAJORES || "0x8004A818BFB912233c491871b3d84c89A494BD9e", chain: "CELO", chainId: 44787, category: "erc8004" },
  ];

  for (const p of globalPairs) {
    push(list, seen, p);
  }

  return list.sort((a, b) => a.chain.localeCompare(b.chain) || a.label.localeCompare(b.label));
}
