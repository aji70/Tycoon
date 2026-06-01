import { encodeFunctionData, type Address, type Hash, type PublicClient } from "viem";
import { custom, http, type Transport } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { getCeloRpcUrlForChainId } from "@/lib/utils/erc8004InjectedEoa";
type InjectedProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMiniPay?: boolean;
};

/**
 * MiniPay docs: route RPC through `window.ethereum`, not a separate HTTP forno URL.
 * @see https://docs.minipay.xyz/getting-started/project-setup.html
 */
export function celoTransportForWagmi(): Transport {
  if (typeof window !== "undefined") {
    const eth = (window as Window & { ethereum?: object }).ethereum;
    if (eth) return custom(eth);
  }
  return http(getCeloRpcUrlForChainId(celo.id));
}

/** MiniPay `eth_estimateGas` often fails on register; fixed limit avoids UnknownRpcError. */
export const MINIPAY_REGISTER_GAS = 600_000n;

export function minipayContractWriteOverrides(): { gas?: bigint } {
  if (typeof window === "undefined") return {};
  const eth = (window as Window & { ethereum?: { isMiniPay?: boolean } }).ethereum;
  if (eth?.isMiniPay) return { gas: MINIPAY_REGISTER_GAS };
  return {};
}

function getInjectedProvider(): InjectedProvider {
  const ethereum = (window as Window & { ethereum?: InjectedProvider }).ethereum;
  if (!ethereum?.request) {
    throw new Error("Wallet provider not found. Open this app in MiniPay.");
  }
  return ethereum;
}

const CELO_CHAIN_ID_HEX = `0x${celo.id.toString(16)}`;

/**
 * MiniPay: wagmi/viem writeContract often fails (estimate/simulate → "wallet error").
 * MetaMask works with wagmi; MiniPay needs a plain eth_sendTransaction.
 */
export async function registerPlayerViaMiniPayInjected(params: {
  from: Address;
  contractAddress: Address;
  username: string;
  publicClient?: PublicClient;
}): Promise<Hash> {
  const ethereum = getInjectedProvider();
  const username = params.username.trim();
  if (!username) throw new Error("Username cannot be empty");

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet",
    args: [username],
  });

  try {
    const chainId = (await ethereum.request({ method: "eth_chainId" })) as string;
    if (chainId?.toLowerCase() !== CELO_CHAIN_ID_HEX) {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CELO_CHAIN_ID_HEX }],
      });
    }
  } catch {
    // MiniPay is Celo-only; switch may be unsupported — continue
  }

  const hash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: params.from,
        to: params.contractAddress,
        data,
        gas: `0x${MINIPAY_REGISTER_GAS.toString(16)}`,
      },
    ],
  })) as Hash;

  if (params.publicClient) {
    await params.publicClient.waitForTransactionReceipt({ hash });
  } else {
    await waitForInjectedTxReceipt(ethereum, hash);
  }

  return hash;
}

async function waitForInjectedTxReceipt(
  ethereum: InjectedProvider,
  hash: Hash,
  maxAttempts = 90
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("Transaction reverted on-chain");
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Transaction not confirmed. Check your wallet activity.");
}
