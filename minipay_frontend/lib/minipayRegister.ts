import { getAccount, simulateContract, writeContract } from "@wagmi/core";
import type { Address, Hash } from "viem";
import { celo } from "wagmi/chains";
import TycoonABI from "@/context/abi/tycoonabi.json";
import { wagmiConfig } from "@/config";
import { ensureMiniPayWagmiConnected } from "@/lib/connectMiniPayWallet";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
import { MINIPAY_FEE_CURRENCY } from "@/lib/celoTransportForWagmi";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";

/** Registration mints welcome vouchers — needs more gas than createGame. */
const MINIPAY_REGISTER_GAS = BigInt(1_200_000);

type RegisterArgs = {
  contractAddress: Address;
  username: string;
};

/**
 * MiniPay wallet-signed registration — same stack as createGame (@wagmi/core + simulate),
 * but registration-only gas (no feeCurrency: MiniPay picks cUSD/USDC automatically).
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

  const attempts: Array<{ gas?: bigint; feeCurrency?: Address }> = [
    { gas: MINIPAY_REGISTER_GAS },
    { gas: MINIPAY_REGISTER_GAS, feeCurrency: MINIPAY_FEE_CURRENCY },
    {},
  ];

  let lastError: unknown;
  let lastRevertError: unknown;
  for (const overrides of attempts) {
    try {
      const { request } = await simulateContract(wagmiConfig, {
        ...base,
        ...overrides,
      });
      return await writeContract(wagmiConfig, request);
    } catch (err) {
      lastError = err;
      const hay = getContractErrorMessage(err, "");
      if (
        hay &&
        !hay.toLowerCase().includes("unknown rpc") &&
        (hay.includes("rejected") ||
          hay.includes("already registered") ||
          hay.includes("Smart contract"))
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
