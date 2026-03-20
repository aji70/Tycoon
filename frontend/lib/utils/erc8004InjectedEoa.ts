import { createWalletClient, custom, getAddress, type Address, type Chain } from "viem";
import { celo, celoAlfajores } from "viem/chains";
import type { Abi } from "viem";

type EthereumProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

function asProvider(raw: unknown): EthereumProvider | null {
  if (!raw || typeof (raw as EthereumProvider).request !== "function") return null;
  return raw as EthereumProvider;
}

/**
 * Prefer MetaMask when multiple wallets stack `window.ethereum.providers`.
 */
export function getInjectedEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { ethereum?: unknown };
  const raw = w.ethereum;
  if (!raw) return null;
  const providers = (raw as { providers?: unknown[] }).providers;
  if (Array.isArray(providers) && providers.length > 0) {
    const preferred =
      providers.find((p) => (p as { isMetaMask?: boolean }).isMetaMask) ?? providers[0];
    return asProvider(preferred);
  }
  return asProvider(raw);
}

export function celoChainFromId(chainId: number): Chain {
  return chainId === 44787 ? celoAlfajores : celo;
}

/**
 * Calls IdentityRegistry.register(agentURI) from the injected browser wallet (EOA).
 * Bypasses wagmi / WalletConnect so the NFT is always minted to the extension account.
 */
export async function registerErc8004AgentViaInjectedEoa(params: {
  chainId: number;
  contractAddress: Address;
  abi: Abi;
  agentURI: string;
}): Promise<{ hash: `0x${string}`; account: Address }> {
  const provider = getInjectedEthereumProvider();
  if (!provider) {
    throw new Error(
      "No browser extension wallet found. Install MetaMask (or another injected EVM wallet), then try again. ERC-8004 registration must be signed by an EOA."
    );
  }

  const chain = celoChainFromId(params.chainId);
  const walletClient = createWalletClient({
    chain,
    transport: custom(provider),
  });

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Unlock your wallet and allow this site to use your accounts.");
  }

  const account = getAddress(accounts[0] as Address);

  try {
    await walletClient.switchChain({ id: chain.id });
  } catch {
    // Already on chain or wallet will prompt on send
  }

  const hash = await walletClient.writeContract({
    address: params.contractAddress,
    abi: params.abi,
    functionName: "register",
    args: [params.agentURI],
    account,
    chain,
  });

  return { hash, account };
}

/** First account from the injected wallet (no prompt if already authorized). */
export async function getInjectedEoaAddress(): Promise<Address | null> {
  const provider = getInjectedEthereumProvider();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!Array.isArray(accounts) || !accounts[0]) return null;
    return getAddress(accounts[0] as Address);
  } catch {
    return null;
  }
}
