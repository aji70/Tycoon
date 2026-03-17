"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseUnits, formatUnits, type Address, type Abi } from "viem";
import RewardABI from "@/context/abi/rewardabi.json";
import {
  REWARD_CONTRACT_ADDRESSES,
  TYCOON_CONTRACT_ADDRESSES,
  USDC_TOKEN_ADDRESS,
  TYC_TOKEN_ADDRESS,
  NAIRA_VAULT_ADDRESSES,
} from "@/constants/contracts";
import TycoonABI from "@/context/abi/tycoonabi.json";
import type { CollectiblePerk as ContractCollectiblePerk } from "@/context/ContractProvider";
import {
  useRewardSetBackendMinter,
  useRewardMintVoucher,
  useRewardMintCollectible,
  useRewardStockShop,
  useRewardStockBundle,
  useRewardRestockCollectible,
  useRewardUpdateCollectiblePrices,
  useRewardPause,
  useRewardWithdrawFunds,
  useTycoonAdminReads,
  useTycoonSetMinStake,
  useTycoonSetMinTurnsForPerks,
  useTycoonSetBackendGameController,
  useTycoonSetLogicContract,
  useTycoonSetUserRegistry,
  useTycoonSetGameFaucet,
  useTycoonSetRewardSystem,
  useTycoonCreateWalletForExistingUser,
} from "@/context/ContractProvider";
import { apiClient } from "@/lib/api";
import { ApiResponse } from "@/types/api";
import {
  CollectiblePerk,
  PERK_NAMES,
  ERC20_ABI,
  INITIAL_COLLECTIBLES,
} from "@/components/rewards/rewardsConstants";

/** Bundle definitions for "Stock Bundles" — must match shop BUNDLE_DEFS; perks must be stocked first. */
const BUNDLE_DEFS_FOR_STOCK: Array<{
  name: string;
  items: Array<{ perk: number; strength: number; quantity: number }>;
  price_tyc: string;
  price_usdc: string;
}> = [
  { name: "Starter Pack", price_tyc: "45", price_usdc: "2.5", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Lucky Bundle", price_tyc: "60", price_usdc: "3", items: [{ perk: 2, strength: 1, quantity: 1 }, { perk: 6, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Defender Pack", price_tyc: "55", price_usdc: "2.75", items: [{ perk: 7, strength: 1, quantity: 1 }, { perk: 2, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }] },
  { name: "High Roller", price_tyc: "65", price_usdc: "3.25", items: [{ perk: 3, strength: 1, quantity: 1 }, { perk: 4, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }] },
  { name: "Cash Flow", price_tyc: "70", price_usdc: "3.5", items: [{ perk: 5, strength: 1, quantity: 1 }, { perk: 8, strength: 1, quantity: 1 }, { perk: 9, strength: 1, quantity: 1 }] },
  { name: "Chaos Bundle", price_tyc: "75", price_usdc: "4", items: [{ perk: 6, strength: 1, quantity: 1 }, { perk: 10, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
  { name: "Landlord's Choice", price_tyc: "50", price_usdc: "2.5", items: [{ perk: 11, strength: 1, quantity: 1 }, { perk: 12, strength: 1, quantity: 1 }, { perk: 14, strength: 1, quantity: 1 }] },
  { name: "Ultimate Pack", price_tyc: "80", price_usdc: "4.5", items: [{ perk: 1, strength: 1, quantity: 1 }, { perk: 3, strength: 1, quantity: 1 }, { perk: 7, strength: 1, quantity: 1 }, { perk: 13, strength: 1, quantity: 1 }] },
];

export type RewardsSection = "overview" | "mint" | "stock" | "manage" | "funds" | "tycoon" | "escrow" | "tournaments" | "reads" | "vault";

export interface RewardsAdminState {
  activeSection: RewardsSection;
  status: { type: "success" | "error" | "info"; message: string } | null;
  isPaused: boolean;
  backendMinter: Address | null;
  owner: Address | null;
  totalGames: number;
  totalUsers: number;
  newMinter: string;
  voucherRecipient: string;
  voucherValue: string;
  collectibleRecipient: string;
  selectedPerk: CollectiblePerk;
  collectibleStrength: string;
  restockTokenId: string;
  restockAmount: string;
  updateTokenId: string;
  updateTycPrice: string;
  updateUsdcPrice: string;
  withdrawToken: "TYC" | "USDC";
  withdrawAmount: string;
  withdrawTo: string;
  tycoonMinStake: string;
  tycoonMinTurnsForPerks: string;
  tycoonGameController: string;
  tycoonLogicContract: string;
  tycoonUserRegistry: string;
  tycoonGameFaucet: string;
  tycoonRewardSystem: string;
  createWalletPlayerAddress: string;
}

export interface TokenDisplayItem {
  tokenId: bigint;
  perk?: CollectiblePerk;
  strength?: number;
  name: string;
  type: "voucher" | "collectible";
  tycPrice: bigint;
  usdcPrice: bigint;
  stock: bigint;
}

export function useRewardsAdmin() {
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const contractAddress = REWARD_CONTRACT_ADDRESSES[
    chainId as keyof typeof REWARD_CONTRACT_ADDRESSES
  ] as Address | undefined;
  const usdcAddress = USDC_TOKEN_ADDRESS[
    chainId as keyof typeof USDC_TOKEN_ADDRESS
  ] as Address | undefined;
  const tycAddress = TYC_TOKEN_ADDRESS[
    chainId as keyof typeof TYC_TOKEN_ADDRESS
  ] as Address | undefined;

  const [activeSection, setActiveSection] = useState<RewardsSection>("overview");
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [backendMinter, setBackendMinter] = useState<Address | null>(null);
  const [owner, setOwner] = useState<Address | null>(null);
  const [totalGames, setTotalGames] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  const [newMinter, setNewMinter] = useState("");
  const [voucherRecipient, setVoucherRecipient] = useState("");
  const [voucherValue, setVoucherValue] = useState("");
  const [collectibleRecipient, setCollectibleRecipient] = useState("");
  const [selectedPerk, setSelectedPerk] = useState<CollectiblePerk>(
    CollectiblePerk.EXTRA_TURN
  );
  const [collectibleStrength, setCollectibleStrength] = useState("1");
  const [restockTokenId, setRestockTokenId] = useState("");
  const [restockAmount, setRestockAmount] = useState("50");
  const [updateTokenId, setUpdateTokenId] = useState("");
  const [updateTycPrice, setUpdateTycPrice] = useState("");
  const [updateUsdcPrice, setUpdateUsdcPrice] = useState("");
  const [withdrawToken, setWithdrawToken] = useState<"TYC" | "USDC">("TYC");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTo, setWithdrawTo] = useState("");
  const [tycoonMinStake, setTycoonMinStake] = useState("");
  const [tycoonMinTurnsForPerks, setTycoonMinTurnsForPerks] = useState("");
  const [tycoonGameController, setTycoonGameController] = useState("");
  const [tycoonLogicContract, setTycoonLogicContract] = useState("");
  const [tycoonUserRegistry, setTycoonUserRegistry] = useState("");
  const [tycoonGameFaucet, setTycoonGameFaucet] = useState("");
  const [tycoonRewardSystem, setTycoonRewardSystem] = useState("");
  const [createWalletPlayerAddress, setCreateWalletPlayerAddress] = useState("");
  const [readTestTokenId, setReadTestTokenId] = useState("");
  const [checkRegisteredAddress, setCheckRegisteredAddress] = useState("");
  const [vaultWithdrawAmount, setVaultWithdrawAmount] = useState("");
  const [vaultWithdrawTo, setVaultWithdrawTo] = useState("");
  const [vaultWithdrawUsdcAmount, setVaultWithdrawUsdcAmount] = useState("");
  const [vaultWithdrawUsdcTo, setVaultWithdrawUsdcTo] = useState("");
  const [stockAllProgress, setStockAllProgress] = useState<{ active: boolean; current: number; total: number }>({
    active: false,
    current: 0,
    total: 0,
  });

  const NAIRA_VAULT_ABI = [
    { inputs: [], name: "balanceCelo", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "balanceUsdc", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
    { inputs: [], name: "usdc", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
    { inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], name: "creditCelo", outputs: [], stateMutability: "nonpayable", type: "function" },
    { inputs: [{ name: "recipient", type: "address" }, { name: "amount", type: "uint256" }], name: "creditUsdc", outputs: [], stateMutability: "nonpayable", type: "function" },
  ] as const;
  const ERC20_DECIMALS_ABI = [{ inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" }] as const;
  const vaultAddress = NAIRA_VAULT_ADDRESSES[chainId as keyof typeof NAIRA_VAULT_ADDRESSES];
  const vaultUsdcToken = useReadContract({
    address: vaultAddress,
    abi: NAIRA_VAULT_ABI,
    functionName: "usdc",
    query: { enabled: !!vaultAddress },
  });
  const vaultUsdcDecimals = useReadContract({
    address: vaultUsdcToken.data,
    abi: ERC20_DECIMALS_ABI,
    functionName: "decimals",
    query: { enabled: !!vaultUsdcToken.data },
  });
  const vaultCeloBalance = useReadContract({
    address: vaultAddress,
    abi: NAIRA_VAULT_ABI,
    functionName: "balanceCelo",
    query: { enabled: !!vaultAddress },
  });
  const vaultUsdcBalance = useReadContract({
    address: vaultAddress,
    abi: NAIRA_VAULT_ABI,
    functionName: "balanceUsdc",
    query: { enabled: !!vaultAddress },
  });
  const vaultCreditCelo = useWriteContract();
  const vaultCreditCeloReceipt = useWaitForTransactionReceipt({ hash: vaultCreditCelo.data });
  const vaultCreditUsdc = useWriteContract();
  const vaultCreditUsdcReceipt = useWaitForTransactionReceipt({ hash: vaultCreditUsdc.data });

  const setMinterHook = useRewardSetBackendMinter();
  const tycoonReads = useTycoonAdminReads();
  const tycoonSetMinStakeHook = useTycoonSetMinStake();
  const tycoonSetMinTurnsHook = useTycoonSetMinTurnsForPerks();
  const tycoonSetControllerHook = useTycoonSetBackendGameController();
  const tycoonSetLogicHook = useTycoonSetLogicContract();
  const tycoonSetUserRegistryHook = useTycoonSetUserRegistry();
  const tycoonSetGameFaucetHook = useTycoonSetGameFaucet();
  const tycoonSetRewardSystemHook = useTycoonSetRewardSystem();
  const tycoonCreateWalletHook = useTycoonCreateWalletForExistingUser();
  const mintVoucherHook = useRewardMintVoucher();
  const mintCollectibleHook = useRewardMintCollectible();
  const stockShopHook = useRewardStockShop();
  const stockBundleHook = useRewardStockBundle();
  const restockHook = useRewardRestockCollectible();
  const updateHook = useRewardUpdateCollectiblePrices();
  const pauseHook = useRewardPause();
  const withdrawHook = useRewardWithdrawFunds();

  const pausedResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "paused",
    query: { enabled: !!contractAddress },
  });

  const backendMinterResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "backendMinter",
    query: { enabled: !!contractAddress },
  });

  const ownerResult = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "owner",
    query: { enabled: !!contractAddress },
  });

  const tycBalance = useReadContract({
    address: tycAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!tycAddress },
  });

  const usdcBalance = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress && !!usdcAddress },
  });

  const contractTokenCount = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "ownedTokenCount",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });

  const tokenCount = Number(contractTokenCount.data ?? 0);

  const tokenOfOwnerCalls = Array.from({ length: tokenCount }, (_, i) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "tokenOfOwnerByIndex",
    args: [contractAddress!, BigInt(i)],
  } as const));

  const tokenIdResults = useReadContracts({
    contracts: tokenOfOwnerCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && tokenCount > 0 },
  });

  const allTokenIds =
    tokenIdResults.data
      ?.map((res) =>
        res.status === "success" ? res.result : undefined
      )
      .filter((id): id is bigint => id !== undefined) ?? [];

  const collectibleInfoCalls = allTokenIds.map((tokenId) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCollectibleInfo",
    args: [tokenId],
  } as const));

  const tokenInfoResults = useReadContracts({
    contracts: collectibleInfoCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress && allTokenIds.length > 0 },
  });

  const rewardTycToken = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "tycToken",
    query: { enabled: !!contractAddress },
  });
  const rewardUsdc = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "usdc",
    query: { enabled: !!contractAddress },
  });
  const cashTierCalls = [1, 2, 3, 4, 5].map((tier) => ({
    address: contractAddress!,
    abi: RewardABI as Abi,
    functionName: "getCashTierValue" as const,
    args: [BigInt(tier)] as const,
  }));
  const cashTierResults = useReadContracts({
    contracts: cashTierCalls,
    allowFailure: true,
    query: { enabled: !!contractAddress },
  });
  const readTestCollectibleInfo = useReadContract({
    address: contractAddress,
    abi: RewardABI,
    functionName: "getCollectibleInfo",
    args: readTestTokenId !== "" && /^\d+$/.test(readTestTokenId) ? [BigInt(readTestTokenId)] : undefined,
    query: { enabled: !!contractAddress && readTestTokenId !== "" && /^\d+$/.test(readTestTokenId) },
  });

  const tycoonAddress = TYCOON_CONTRACT_ADDRESSES[chainId as keyof typeof TYCOON_CONTRACT_ADDRESSES];
  const isValidEthAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);
  const registeredCheckResult = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI as Abi,
    functionName: "registered",
    args: isValidEthAddress(checkRegisteredAddress) ? [checkRegisteredAddress as Address] : undefined,
    query: { enabled: !!tycoonAddress && isValidEthAddress(checkRegisteredAddress) },
  });
  const addressToUsernameResult = useReadContract({
    address: tycoonAddress,
    abi: TycoonABI as Abi,
    functionName: "addressToUsername",
    args: isValidEthAddress(checkRegisteredAddress) ? [checkRegisteredAddress as Address] : undefined,
    query: { enabled: !!tycoonAddress && isValidEthAddress(checkRegisteredAddress) },
  });

  const registryAddressForWallet =
    tycoonUserRegistry && isValidEthAddress(tycoonUserRegistry) ? (tycoonUserRegistry as Address) : undefined;
  const hasWalletResult = useReadContract({
    address: registryAddressForWallet,
    abi: [
      {
        inputs: [{ name: "ownerAddress", type: "address" }],
        name: "hasWallet",
        outputs: [{ type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
    ] as Abi,
    functionName: "hasWallet",
    args: isValidEthAddress(checkRegisteredAddress) ? [checkRegisteredAddress as Address] : undefined,
    query: {
      enabled: !!registryAddressForWallet && isValidEthAddress(checkRegisteredAddress),
    },
  });

  const allTokens: TokenDisplayItem[] =
    (tokenInfoResults.data
      ?.map((result, index) => {
        if (result?.status !== "success") return null;
        const [perk, strength, tycPrice, usdcPrice, stock] = result.result as [
          number,
          bigint,
          bigint,
          bigint,
          bigint
        ];
        const tokenId = allTokenIds[index];
        const isVoucher = tokenId < 2_000_000_000;

        return {
          tokenId,
          perk: !isVoucher ? (perk as CollectiblePerk) : undefined,
          strength: !isVoucher ? Number(strength) : undefined,
          name: isVoucher
            ? `Voucher #${tokenId.toString()}`
            : PERK_NAMES[perk as CollectiblePerk] || `Collectible #${perk}`,
          type: isVoucher ? "voucher" : "collectible",
          tycPrice,
          usdcPrice,
          stock,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null) ?? []) as TokenDisplayItem[];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const gamesRes = await apiClient.get<ApiResponse>("/games");
        setTotalGames(gamesRes.data?.data.length ?? 0);
        const usersRes = await apiClient.get<unknown[]>("/users");
        setTotalUsers(Array.isArray(usersRes.data) ? usersRes.data.length : 0);
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    setIsPaused(!!pausedResult.data);
    setBackendMinter((backendMinterResult.data as Address) ?? null);
    setOwner((ownerResult.data as Address) ?? null);
    setWithdrawTo((ownerResult.data as string) ?? "");
  }, [pausedResult.data, backendMinterResult.data, ownerResult.data]);

  const zeroAddr = "0x0000000000000000000000000000000000000000";
  useEffect(() => {
    if (tycoonReads.minStake != null) setTycoonMinStake(formatUnits(tycoonReads.minStake, 6));
    if (tycoonReads.minTurnsForPerks != null) setTycoonMinTurnsForPerks(tycoonReads.minTurnsForPerks.toString());
    if (tycoonReads.backendGameController != null)
      setTycoonGameController(tycoonReads.backendGameController === zeroAddr ? "" : tycoonReads.backendGameController);
    if (tycoonReads.logicContract != null)
      setTycoonLogicContract(tycoonReads.logicContract === zeroAddr ? "" : tycoonReads.logicContract);
    if (tycoonReads.userRegistry != null)
      setTycoonUserRegistry(tycoonReads.userRegistry === zeroAddr ? "" : tycoonReads.userRegistry);
    if (tycoonReads.gameFaucet != null)
      setTycoonGameFaucet(tycoonReads.gameFaucet === zeroAddr ? "" : tycoonReads.gameFaucet);
    if (tycoonReads.rewardSystem != null)
      setTycoonRewardSystem(tycoonReads.rewardSystem === zeroAddr ? "" : tycoonReads.rewardSystem);
  }, [
    tycoonReads.minStake,
    tycoonReads.minTurnsForPerks,
    tycoonReads.backendGameController,
    tycoonReads.logicContract,
    tycoonReads.userRegistry,
    tycoonReads.gameFaucet,
    tycoonReads.rewardSystem,
  ]);

  useEffect(() => {
    const successes = [
      setMinterHook.isSuccess,
      mintVoucherHook.isSuccess,
      mintCollectibleHook.isSuccess,
      stockShopHook.isSuccess,
      stockBundleHook.isSuccess,
      restockHook.isSuccess,
      updateHook.isSuccess,
      pauseHook.isSuccess,
      withdrawHook.isSuccess,
      tycoonSetMinStakeHook.isSuccess,
      tycoonSetMinTurnsHook.isSuccess,
      tycoonSetControllerHook.isSuccess,
      tycoonSetLogicHook.isSuccess,
      tycoonSetUserRegistryHook.isSuccess,
      tycoonSetGameFaucetHook.isSuccess,
      tycoonSetRewardSystemHook.isSuccess,
      tycoonCreateWalletHook.isSuccess,
      vaultCreditCeloReceipt.isSuccess,
    ];
    if (successes.some(Boolean)) {
      setStatus({ type: "success", message: "Transaction successful!" });
      setMinterHook.reset?.();
      mintVoucherHook.reset?.();
      mintCollectibleHook.reset?.();
      stockShopHook.reset?.();
      stockBundleHook.reset?.();
      restockHook.reset?.();
      updateHook.reset?.();
      pauseHook.reset?.();
      withdrawHook.reset?.();
      tycoonSetMinStakeHook.reset?.();
      tycoonSetMinTurnsHook.reset?.();
      tycoonSetControllerHook.reset?.();
      tycoonSetLogicHook.reset?.();
      tycoonSetUserRegistryHook.reset?.();
      tycoonSetGameFaucetHook.reset?.();
      tycoonSetRewardSystemHook.reset?.();
      tycoonCreateWalletHook.reset?.();
      vaultCreditCelo.reset?.();
    }
  }, [
    setMinterHook.isSuccess,
    mintVoucherHook.isSuccess,
    mintCollectibleHook.isSuccess,
    stockShopHook.isSuccess,
    stockBundleHook.isSuccess,
    restockHook.isSuccess,
    updateHook.isSuccess,
    pauseHook.isSuccess,
    withdrawHook.isSuccess,
    tycoonSetMinStakeHook.isSuccess,
    tycoonSetMinTurnsHook.isSuccess,
    tycoonSetControllerHook.isSuccess,
    tycoonSetLogicHook.isSuccess,
    tycoonSetUserRegistryHook.isSuccess,
    tycoonSetGameFaucetHook.isSuccess,
    tycoonSetRewardSystemHook.isSuccess,
    tycoonCreateWalletHook.isSuccess,
    vaultCreditCeloReceipt.isSuccess,
  ]);

  useEffect(() => {
    const errors = [
      setMinterHook.error,
      mintVoucherHook.error,
      mintCollectibleHook.error,
      stockShopHook.error,
      stockBundleHook.error,
      restockHook.error,
      updateHook.error,
      pauseHook.error,
      withdrawHook.error,
      tycoonSetMinStakeHook.error,
      tycoonSetMinTurnsHook.error,
      tycoonSetControllerHook.error,
      tycoonSetLogicHook.error,
      tycoonSetUserRegistryHook.error,
      tycoonSetGameFaucetHook.error,
      tycoonSetRewardSystemHook.error,
      tycoonCreateWalletHook.error,
      vaultCreditCelo.error,
    ].filter(Boolean);
    if (errors.length > 0) {
      setStatus({
        type: "error",
        message: (errors[0] as Error)?.message || "Transaction failed",
      });
    }
  }, [
    setMinterHook.error,
    mintVoucherHook.error,
    mintCollectibleHook.error,
    stockShopHook.error,
    stockBundleHook.error,
    restockHook.error,
    updateHook.error,
    pauseHook.error,
    withdrawHook.error,
    tycoonSetMinStakeHook.error,
    tycoonSetMinTurnsHook.error,
    tycoonSetControllerHook.error,
    tycoonSetLogicHook.error,
    tycoonSetUserRegistryHook.error,
    tycoonSetGameFaucetHook.error,
    tycoonSetRewardSystemHook.error,
    tycoonCreateWalletHook.error,
    vaultCreditCelo.error,
  ]);

  const handleSetBackendMinter = async () => {
    if (!newMinter) return;
    await setMinterHook.setMinter(newMinter as Address);
    setNewMinter("");
  };

  const handleMintVoucher = async () => {
    if (!voucherRecipient || !voucherValue) return;
    const valueWei = parseUnits(voucherValue, 18);
    await mintVoucherHook.mint(voucherRecipient as Address, valueWei);
    setVoucherRecipient("");
    setVoucherValue("");
  };

  const handleMintCollectible = async () => {
    if (!collectibleRecipient) return;
    await mintCollectibleHook.mint(
      collectibleRecipient as Address,
      selectedPerk as unknown as ContractCollectiblePerk,
      Number(collectibleStrength || 1)
    );
    setCollectibleRecipient("");
    setCollectibleStrength("1");
  };

  const handleStockShop = async (perk: CollectiblePerk, strength: number) => {
    const selectedItem = INITIAL_COLLECTIBLES.find(
      (item) => item.perk === perk && item.strength === strength
    );
    const tycPrice = selectedItem
      ? parseUnits(selectedItem.tycPrice, 18)
      : parseUnits("1.0", 18);
    const usdcPrice = selectedItem
      ? parseUnits(selectedItem.usdcPrice, 6)
      : parseUnits("0.20", 6);
    await stockShopHook.stock(
      50,
      perk as unknown as ContractCollectiblePerk,
      strength,
      Number(tycPrice),
      Number(usdcPrice)
    );
  };

  const handleStockBundle = async (bundleName: string) => {
    const def = BUNDLE_DEFS_FOR_STOCK.find((b) => b.name === bundleName);
    if (!def) return;
    const collectibles = allTokens.filter((t): t is TokenDisplayItem & { perk: CollectiblePerk; strength: number } => t.type === "collectible" && t.perk != null && t.strength != null);
    const tokenIds: bigint[] = [];
    const amounts: bigint[] = [];
    for (const li of def.items) {
      const match = collectibles.find((c) => Number(c.perk) === li.perk && c.strength === li.strength);
      if (!match) {
        setStatus({ type: "error", message: `Bundle "${bundleName}": perk ${li.perk} (tier ${li.strength}) not in shop. Stock perks first.` });
        return;
      }
      for (let q = 0; q < li.quantity; q++) {
        tokenIds.push(match.tokenId);
        amounts.push(BigInt(1));
      }
    }
    const tycPrice = parseUnits(def.price_tyc, 18);
    const usdcPrice = parseUnits(def.price_usdc, 6);
    await stockBundleHook.stockBundle(tokenIds, amounts, tycPrice, usdcPrice);
  };

  const handleStockAllPerks = async () => {
    const total = INITIAL_COLLECTIBLES.length;
    setStockAllProgress({ active: true, current: 0, total });
    try {
      for (let i = 0; i < INITIAL_COLLECTIBLES.length; i++) {
        setStockAllProgress((prev) => ({ ...prev, current: i + 1 }));
        const item = INITIAL_COLLECTIBLES[i];
        const tycPrice = parseUnits(item.tycPrice, 18);
        const usdcPrice = parseUnits(item.usdcPrice, 6);
        const hash = await stockShopHook.stock(
          50,
          item.perk as unknown as ContractCollectiblePerk,
          item.strength,
          Number(tycPrice),
          Number(usdcPrice)
        );
        if (publicClient && hash) {
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }
      setStatus({ type: "success", message: "Shop stocked with 50 of each perk." });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Stock all failed";
      setStatus({ type: "error", message: msg });
    } finally {
      setStockAllProgress({ active: false, current: 0, total: 0 });
    }
  };

  const handleRestock = async () => {
    if (!restockTokenId || !restockAmount) return;
    await restockHook.restock(
      BigInt(restockTokenId),
      BigInt(restockAmount)
    );
    setRestockTokenId("");
    setRestockAmount("50");
  };

  const handleUpdatePrices = async () => {
    if (!updateTokenId) return;
    const tycWei = updateTycPrice ? parseUnits(updateTycPrice, 18) : BigInt(0);
    const usdcWei = updateUsdcPrice ? parseUnits(updateUsdcPrice, 6) : BigInt(0);
    await updateHook.update(BigInt(updateTokenId), tycWei, usdcWei);
    setUpdateTokenId("");
    setUpdateTycPrice("");
    setUpdateUsdcPrice("");
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || !withdrawTo || !tycAddress || !usdcAddress) return;
    const tokenAddr = withdrawToken === "TYC" ? tycAddress : usdcAddress;
    const decimals = withdrawToken === "TYC" ? 18 : 6;
    const amountWei = parseUnits(withdrawAmount, decimals);
    await withdrawHook.withdraw(tokenAddr, withdrawTo as Address, amountWei);
    setWithdrawAmount("");
  };

  const handleSetTycoonMinStake = async () => {
    if (!tycoonMinStake) return;
    const wei = parseUnits(tycoonMinStake, 6);
    await tycoonSetMinStakeHook.setMinStake(wei);
  };

  const handleSetTycoonMinTurnsForPerks = async () => {
    if (tycoonMinTurnsForPerks === "") return;
    await tycoonSetMinTurnsHook.setMinTurnsForPerks(BigInt(tycoonMinTurnsForPerks));
  };

  const handleSetTycoonGameController = async () => {
    const addr = tycoonGameController.trim();
    if (!addr) return;
    await tycoonSetControllerHook.setBackendGameController(addr as Address);
  };

  const handleSetTycoonLogicContract = async () => {
    const addr = tycoonLogicContract.trim();
    if (!addr) return;
    await tycoonSetLogicHook.setLogicContract(addr as Address);
  };

  const handleSetTycoonUserRegistry = async () => {
    const addr = tycoonUserRegistry.trim();
    if (!addr) return;
    await tycoonSetUserRegistryHook.setUserRegistry(addr as Address);
  };

  const handleSetTycoonGameFaucet = async () => {
    const addr = tycoonGameFaucet.trim();
    if (!addr) return;
    await tycoonSetGameFaucetHook.setGameFaucet(addr as Address);
  };

  const handleSetTycoonRewardSystem = async () => {
    const addr = tycoonRewardSystem.trim();
    if (!addr) return;
    await tycoonSetRewardSystemHook.setRewardSystem(addr as Address);
  };

  const handleCreateWalletForExistingUser = async () => {
    const addr = createWalletPlayerAddress.trim();
    if (!addr) return;
    await tycoonCreateWalletHook.createWalletForExistingUser(addr as Address);
    setCreateWalletPlayerAddress("");
  };

  const handleVaultWithdrawCelo = async () => {
    if (!vaultAddress || !vaultWithdrawTo.trim() || !vaultWithdrawAmount) return;
    const amountWei = parseUnits(vaultWithdrawAmount, 18);
    await vaultCreditCelo.writeContractAsync({
      address: vaultAddress,
      abi: NAIRA_VAULT_ABI,
      functionName: "creditCelo",
      args: [vaultWithdrawTo.trim() as Address, amountWei],
    });
    setVaultWithdrawAmount("");
    setVaultWithdrawTo("");
  };

  const handleVaultWithdrawUsdc = async () => {
    if (!vaultAddress || !vaultWithdrawUsdcTo.trim() || !vaultWithdrawUsdcAmount) return;
    const decimals = Number(vaultUsdcDecimals.data ?? 6);
    const amountUnits = parseUnits(vaultWithdrawUsdcAmount, decimals);
    await vaultCreditUsdc.writeContractAsync({
      address: vaultAddress,
      abi: NAIRA_VAULT_ABI,
      functionName: "creditUsdc",
      args: [vaultWithdrawUsdcTo.trim() as Address, amountUnits],
    });
    setVaultWithdrawUsdcAmount("");
    setVaultWithdrawUsdcTo("");
  };

  const anyPending =
    setMinterHook.isPending ||
    mintVoucherHook.isPending ||
    mintCollectibleHook.isPending ||
    stockShopHook.isPending ||
    restockHook.isPending ||
    updateHook.isPending ||
    pauseHook.isPending ||
    withdrawHook.isPending ||
    tycoonSetMinStakeHook.isPending ||
    tycoonSetMinTurnsHook.isPending ||
    tycoonSetControllerHook.isPending ||
    tycoonSetLogicHook.isPending ||
    tycoonSetUserRegistryHook.isPending ||
    tycoonSetGameFaucetHook.isPending ||
    tycoonSetRewardSystemHook.isPending ||
    tycoonCreateWalletHook.isPending ||
    vaultCreditCelo.isPending ||
    vaultCreditCeloReceipt.isLoading ||
    vaultCreditUsdc.isPending ||
    vaultCreditUsdcReceipt.isLoading;

  const currentTxHash =
    setMinterHook.txHash ||
    mintVoucherHook.txHash ||
    mintCollectibleHook.txHash ||
    stockShopHook.txHash ||
    restockHook.txHash ||
    updateHook.txHash ||
    pauseHook.txHash ||
    withdrawHook.txHash ||
    tycoonSetMinStakeHook.txHash ||
    tycoonSetMinTurnsHook.txHash ||
    tycoonSetControllerHook.txHash ||
    tycoonSetLogicHook.txHash ||
    tycoonSetUserRegistryHook.txHash ||
    tycoonSetGameFaucetHook.txHash ||
    tycoonSetRewardSystemHook.txHash ||
    tycoonCreateWalletHook.txHash ||
    vaultCreditCelo.data ||
    vaultCreditUsdc.data;

  return {
    auth: {
      isConnected: !!isConnected && !!userAddress,
      userAddress,
      contractAddress,
      chainId,
      owner,
      isOwner: !owner || (userAddress && owner.toLowerCase() === userAddress.toLowerCase()),
    },
    state: {
      activeSection,
      setActiveSection,
      status,
      isPaused,
      backendMinter,
      owner,
      totalGames,
      totalUsers,
      newMinter,
      setNewMinter,
      voucherRecipient,
      setVoucherRecipient,
      voucherValue,
      setVoucherValue,
      collectibleRecipient,
      setCollectibleRecipient,
      selectedPerk,
      setSelectedPerk,
      collectibleStrength,
      setCollectibleStrength,
      restockTokenId,
      setRestockTokenId,
      restockAmount,
      setRestockAmount,
      updateTokenId,
      setUpdateTokenId,
      updateTycPrice,
      setUpdateTycPrice,
      updateUsdcPrice,
      setUpdateUsdcPrice,
      withdrawToken,
      setWithdrawToken,
      withdrawAmount,
      setWithdrawAmount,
      withdrawTo,
      setWithdrawTo,
      tycoonMinStake,
      setTycoonMinStake,
      tycoonMinTurnsForPerks,
      setTycoonMinTurnsForPerks,
      tycoonGameController,
      setTycoonGameController,
      tycoonLogicContract,
      setTycoonLogicContract,
      tycoonUserRegistry,
      setTycoonUserRegistry,
      tycoonGameFaucet,
      setTycoonGameFaucet,
      tycoonRewardSystem,
      setTycoonRewardSystem,
      createWalletPlayerAddress,
      setCreateWalletPlayerAddress,
      readTestTokenId,
      setReadTestTokenId,
      tycoonReads,
      rewardTycToken: rewardTycToken.data as Address | undefined,
      rewardUsdc: rewardUsdc.data as Address | undefined,
      cashTierValues: cashTierResults.data?.map((r) => (r.status === "success" ? r.result : undefined)) ?? [],
      readTestCollectibleInfo: readTestCollectibleInfo.data as [number, bigint, bigint, bigint, bigint] | undefined,
      readTestCollectibleInfoLoading: readTestCollectibleInfo.isLoading,
      checkRegisteredAddress,
      setCheckRegisteredAddress,
      isRegistered: registeredCheckResult.data as boolean | undefined,
      isRegisteredLoading: registeredCheckResult.isLoading,
      addressToUsername: addressToUsernameResult.data as string | undefined,
      hasSmartWallet: hasWalletResult.data as boolean | undefined,
      hasSmartWalletLoading: hasWalletResult.isLoading,
      vaultNairaAddress: vaultAddress,
      vaultUsdcTokenAddress: vaultUsdcToken.data as Address | undefined,
      vaultCeloBalance: vaultCeloBalance.data,
      vaultUsdcBalance: vaultUsdcBalance.data,
      vaultUsdcDecimals: vaultUsdcDecimals.data,
      vaultWithdrawAmount,
      setVaultWithdrawAmount,
      vaultWithdrawTo,
      setVaultWithdrawTo,
      vaultWithdrawUsdcAmount,
      setVaultWithdrawUsdcAmount,
      vaultWithdrawUsdcTo,
      setVaultWithdrawUsdcTo,
      stockAllProgress,
    },
    contract: {
      tycBalance: tycBalance.data,
      usdcBalance: usdcBalance.data,
      tokenCount,
      allTokens,
      bundleDefsForStock: BUNDLE_DEFS_FOR_STOCK,
    },
    handlers: {
      handleSetBackendMinter,
      handleMintVoucher,
      handleMintCollectible,
      handleStockShop,
      handleStockAllPerks,
      handleStockBundle,
      handleRestock,
      handleUpdatePrices,
      handleWithdraw,
      handleSetTycoonMinStake,
      handleSetTycoonMinTurnsForPerks,
      handleSetTycoonGameController,
      handleSetTycoonLogicContract,
      handleSetTycoonUserRegistry,
      handleSetTycoonGameFaucet,
      handleSetTycoonRewardSystem,
      handleCreateWalletForExistingUser,
      handleVaultWithdrawCelo,
      handleVaultWithdrawUsdc,
      pause: pauseHook.pause,
      unpause: pauseHook.unpause,
    },
    pending: {
      anyPending,
      currentTxHash,
      pendingMinter: setMinterHook.isPending,
      pendingVoucher: mintVoucherHook.isPending,
      pendingCollectible: mintCollectibleHook.isPending,
      pendingStock: stockShopHook.isPending,
      pendingStockBundle: stockBundleHook.isPending,
      pendingRestock: restockHook.isPending,
      pendingUpdate: updateHook.isPending,
      pendingPause: pauseHook.isPending,
      pendingWithdraw: withdrawHook.isPending,
      pendingTycoonMinStake: tycoonSetMinStakeHook.isPending,
      pendingTycoonMinTurns: tycoonSetMinTurnsHook.isPending,
      pendingTycoonController: tycoonSetControllerHook.isPending,
      pendingTycoonLogic: tycoonSetLogicHook.isPending,
      pendingTycoonUserRegistry: tycoonSetUserRegistryHook.isPending,
      pendingTycoonGameFaucet: tycoonSetGameFaucetHook.isPending,
      pendingTycoonRewardSystem: tycoonSetRewardSystemHook.isPending,
      pendingCreateWallet: tycoonCreateWalletHook.isPending,
      pendingVaultWithdraw:
        vaultCreditCelo.isPending ||
        vaultCreditCeloReceipt.isLoading ||
        vaultCreditUsdc.isPending ||
        vaultCreditUsdcReceipt.isLoading,
    },
  };
}
