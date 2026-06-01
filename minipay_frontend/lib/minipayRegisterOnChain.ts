"use client";

import { celo } from "wagmi/chains";
import { encodeFunctionData, getAddress, numberToHex, type Address, type Hash } from "viem";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { TYCOON_CONTRACT_ADDRESSES } from "@/constants/contracts";
import { getInjectedEthereumProvider } from "@/lib/utils/erc8004InjectedEoa";
import {
  MINIPAY_REGISTER_GAS,
  minipayRegistrationFeeAttempts,
} from "@/lib/celoTransportForWagmi";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { isUserRejectedTransaction } from "@/lib/utils/contractErrors";

type InjectedProvider = {
  request: (args: { method: string; params?: readonly unknown[] }) => Promise<unknown>;
};

/** Poll receipt via injected provider only — never Forno HTTP. */
async function waitForReceiptInjected(
  provider: InjectedProvider,
  hash: Hash,
  timeoutMs = 120_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error("Registration transaction reverted on-chain");
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error("Transaction confirmation timed out. Check your wallet activity.");
}

type CeloTxParams = {
  from: Address;
  to: Address;
  data: `0x${string}`;
  gas: string;
  feeCurrency?: Address;
};

/** Send via MiniPay provider (supports Celo `feeCurrency` for gas abstraction). */
async function sendRegisterTx(
  provider: InjectedProvider,
  params: CeloTxParams
): Promise<Hash> {
  const tx: Record<string, string> = {
    from: params.from,
    to: params.to,
    data: params.data,
    gas: params.gas,
  };
  if (params.feeCurrency) {
    tx.feeCurrency = params.feeCurrency;
  }

  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [tx],
  });

  if (typeof hash !== "string" || !hash.startsWith("0x")) {
    throw new Error("Wallet did not return a transaction hash");
  }
  return hash as Hash;
}

/**
 * Register on-chain via MiniPay / injected wallet.
 * Uses `eth_sendTransaction` with fee-currency retries (MiniPay gas abstraction).
 */
export async function registerViaWalletSign(params: {
  finalUsername: string;
  account: Address;
}): Promise<Hash> {
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[celo.id];
  if (!contractAddress) {
    throw new Error("Contract not deployed on this chain");
  }

  const username = params.finalUsername.trim();
  if (!username) {
    throw new Error("Username cannot be empty");
  }

  const provider = getInjectedEthereumProvider();
  if (!provider) {
    throw new Error("Wallet not available. Open in MiniPay or connect your wallet.");
  }

  const account = getAddress(params.account);

  const data = encodeFunctionData({
    abi: TycoonABI,
    functionName: "registerPlayer",
    args: [username],
  });

  const attempts = isMiniPayEmbeddedWallet()
    ? minipayRegistrationFeeAttempts()
    : [{ gas: MINIPAY_REGISTER_GAS }];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const gas = attempt.gas ?? MINIPAY_REGISTER_GAS;
      const hash = await sendRegisterTx(provider, {
        from: account,
        to: contractAddress,
        data,
        gas: numberToHex(gas),
        feeCurrency: attempt.feeCurrency,
      });
      await waitForReceiptInjected(provider, hash);
      return hash;
    } catch (err) {
      lastError = err;
      if (isUserRejectedTransaction(err)) throw err;
    }
  }

  throw lastError ?? new Error("Registration failed. Try again in MiniPay.");
}
