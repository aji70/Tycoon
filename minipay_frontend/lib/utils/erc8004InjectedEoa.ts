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

/** EIP-6963 announce payload (browser extension wallets). */
type Eip6963AnnounceDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: unknown;
};

/**
 * Synchronous fallback when EIP-6963 is not used (older MetaMask).
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

/**
 * Discover injected wallets (MetaMask, Rabby, etc.). AppKit/WC often leaves `window.ethereum` empty
 * or points at a non-extension shim — EIP-6963 still finds the real extension.
 */
export async function getInjectedEthereumProviderAsync(): Promise<EthereumProvider | null> {
  if (typeof window === "undefined") return null;

  const from6963 = await discoverEip6963Providers();
  if (from6963.length > 0) {
    const metamask = from6963.find(
      (d) =>
        d.info.rdns === "io.metamask" ||
        d.info.rdns === "io.metamask.flask" ||
        /metamask/i.test(d.info.name)
    );
    const chosen = asProvider(metamask?.provider ?? from6963[0].provider);
    if (chosen) return chosen;
  }

  return getInjectedEthereumProvider();
}

function discoverEip6963Providers(): Promise<Eip6963AnnounceDetail[]> {
  return new Promise((resolve) => {
    const announced: Eip6963AnnounceDetail[] = [];
    const onAnnounce = (e: Event) => {
      const ev = e as CustomEvent<Eip6963AnnounceDetail>;
      const d = ev.detail;
      if (d?.provider && d.info?.rdns) announced.push(d);
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    window.setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
      resolve(announced);
    }, 450);
  });
}

export function celoChainFromId(chainId: number): Chain {
  return chainId === 44787 ? celoAlfajores : celo;
}

function celoRpcUrl(chainId: number): string {
  if (chainId === 44787) {
    return process.env.NEXT_PUBLIC_ALFAJORES_RPC_URL || "https://alfajores-forno.celo-testnet.org";
  }
  return process.env.NEXT_PUBLIC_CELO_RPC_URL || "https://forno.celo.org";
}

/**
 * Calls IdentityRegistry.register(agentURI) from a browser extension EOA (injected), not WalletConnect.
 */
export async function registerErc8004AgentViaInjectedEoa(params: {
  chainId: number;
  contractAddress: Address;
  abi: Abi;
  agentURI: string;
}): Promise<{ hash: `0x${string}`; account: Address }> {
  const provider = await getInjectedEthereumProviderAsync();
  if (!provider) {
    throw new Error(
      "No browser extension wallet found. Unlock MetaMask (or another injected EVM wallet) and allow this site. If you only use WalletConnect mobile, open this page in the MetaMask in-app browser or use a desktop browser with the MetaMask extension."
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
  const provider = await getInjectedEthereumProviderAsync();
  if (!provider) return null;
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
    if (!Array.isArray(accounts) || !accounts[0]) return null;
    return getAddress(accounts[0] as Address);
  } catch {
    return null;
  }
}

/** Public HTTP RPC for Celo (receipts) — does not depend on wagmi’s active chain. */
export function getCeloRpcUrlForChainId(chainId: number): string {
  return celoRpcUrl(chainId);
}
