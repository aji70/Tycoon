import { getAccount, waitForTransactionReceipt, writeContract } from "@wagmi/core";
import type { Address, Hash } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { wagmiConfig } from "@/config";
import { ensureMiniPayWagmiConnected } from "@/lib/connectMiniPayWallet";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import {
  MINIPAY_REGISTER_GAS,
  minipayRegistrationFeeAttempts,
} from "@/lib/celoTransportForWagmi";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";

type RegisterArgs = {
  contractAddress: Address;
  username: string;
};

/**
 * MiniPay wallet-signed registration — same stack as createGame (writeContract, no simulate).
 * simulateContract often fails or picks the wrong fee currency in the MiniPay WebView.
 */
export async function registerPlayerWalletSignedMinipay(
  params: RegisterArgs
): Promise<Hash> {
  if (!isMiniPayEmbeddedWallet()) {
    throw new Error("registerPlayerWalletSignedMinipay requires MiniPay");
  }

  const username = params.username.trim();
  if (!username) throw new Error("Username cannot be empty");

  await ensureMiniPayWagmiConnected();

  const account = getAccount(wagmiConfig);
  if (!account.address) {
    throw new Error("MiniPay wallet not connected. Reopen the app and try again.");
  }

  const base = {
    address: params.contractAddress,
    abi: TycoonABI,
    functionName: "registerPlayerWithoutWallet" as const,
    args: [username] as const,
    chainId: celo.id,
    account: account.address,
  };

  const attempts = minipayRegistrationFeeAttempts(MINIPAY_REGISTER_GAS);

  let lastError: unknown;
  let lastRevertError: unknown;
  for (const overrides of attempts) {
    try {
      const hash = await writeContract(wagmiConfig, {
        ...base,
        ...overrides,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash, chainId: celo.id });
      return hash;
    } catch (err) {
      lastError = err;
      const hay = getContractErrorMessage(err, "");
      if (
        hay &&
        !hay.toLowerCase().includes("unknown rpc") &&
        (hay.includes("rejected") ||
          hay.includes("already registered") ||
          hay.includes("Username taken"))
      ) {
        lastRevertError = err;
      }
    }
  }

  throw new Error(
    getContractErrorMessage(
      lastRevertError ?? lastError,
      "Registration failed in MiniPay"
    )
  );
}
