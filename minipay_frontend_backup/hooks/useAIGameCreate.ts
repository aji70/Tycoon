"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId } from "wagmi";
import { useAppKitNetwork } from "@reown/appkit/react";
import { toast } from "react-toastify";
import { getContractErrorMessage } from "@/lib/utils/contractErrors";
import { resolveChainForBackend } from "@/lib/utils/chain";
import { generateGameCode } from "@/lib/utils/games";
import { apiClient } from "@/lib/api";
import { useMediaQuery } from "@/components/useMediaQuery";
import {
  useIsRegistered,
  useGetUsername,
  useCreateAIGame,
  useRegisteredAIAgents,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { TYCOON_CONTRACT_ADDRESSES, MINIPAY_CHAIN_IDS } from "@/constants/contracts";
import { shouldUseBackendGuestGameFlow } from "@/lib/minipayGuestFlow";
import type { Address } from "viem";

export const AI_ADDRESSES = [
  "0xA1FF1c93600c3487FABBdAF21B1A360630f8bac6",
  "0xB2EE17D003e63985f3648f6c1d213BE86B474B11",
  "0xC3FF882E779aCbc112165fa1E7fFC093e9353B21",
  "0xD4FFDE5296C3EE6992bAf871418CC3BE84C99C32",
  "0xE5FF75Fcf243C4cE05B9F3dc5Aeb9F901AA361D1",
  "0xF6FF469692a259eD5920C15A78640571ee845E8",
  "0xA7FFE1f969Fa6029Ff2246e79B6A623A665cE69",
  "0xB8FF2cEaCBb67DbB5bc14D570E7BbF339cE240F6",
];

export type AIDifficulty = "easy" | "hard" | "boss";
export type AIDifficultyMode = "same" | "random";

export interface AIGameSettings {
  symbol: string;
  aiCount: number;
  startingCash: number;
  aiDifficulty: AIDifficulty;
  aiDifficultyMode: AIDifficultyMode;
  auction: boolean;
  rentInPrison: boolean;
  mortgage: boolean;
  evenBuild: boolean;
  duration: number;
}

const DEFAULT_SETTINGS: AIGameSettings = {
  symbol: "hat",
  aiCount: 1,
  startingCash: 1500,
  aiDifficulty: "boss",
  aiDifficultyMode: "random",
  auction: true,
  rentInPrison: false,
  mortgage: true,
  evenBuild: true,
  duration: 30,
};

/** Contract expects lowercase: hat, car, dog, thimble, iron, battleship, boot, wheelbarrow. Maps top_hat -> hat. */
function symbolForContract(symbol: string): string {
  const s = (symbol || "hat").toLowerCase().trim();
  if (s === "top_hat") return "hat";
  return s;
}

interface GameCreateResponse {
  data?: { data?: { id: string | number }; id?: string | number };
  id?: string | number;
}

export interface UseAIGameCreateOptions {
  /** When true, redirect to 3D board (ai-play-3d) after creating the game. */
  redirectTo3D?: boolean;
}

export function useAIGameCreate(options?: UseAIGameCreateOptions) {
  const router = useRouter();
  const { address } = useAccount();
  const wagmiChainId = useChainId();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const redirectTo3D = options?.redirectTo3D ?? false;
  const { caipNetwork } = useAppKitNetwork();
  const board3DUrl = redirectTo3D ? (isMobile ? `/board-3d-mobile?gameCode=` : `/board-3d?gameCode=`) : null;
  const guestAuth = useGuestAuthOptional();
  const isGuest = shouldUseBackendGuestGameFlow(guestAuth?.guestUser ?? null, address, wagmiChainId);

  const { data: username, refetch: refetchUsername } = useGetUsername(address);
  const { data: isUserRegistered, isLoading: isRegisteredLoading, refetch: refetchRegistered } = useIsRegistered(address);
  const { agents: registeredAgents, isLoading: agentsLoading, isSupported: registrySupported } =
    useRegisteredAIAgents();

  const isMiniPay = !!caipNetwork?.id && MINIPAY_CHAIN_IDS.includes(Number(caipNetwork.id));
  const chainName = resolveChainForBackend(wagmiChainId, caipNetwork?.name);

  const [settings, setSettings] = useState<AIGameSettings>(DEFAULT_SETTINGS);

  const gameCode = generateGameCode();
  const totalPlayers = settings.aiCount + 1;
  const contractAddress = TYCOON_CONTRACT_ADDRESSES[
    caipNetwork?.id as keyof typeof TYCOON_CONTRACT_ADDRESSES
  ] as Address | undefined;

  const { write: createAiGame, isPending: isCreatePending } = useCreateAIGame(
    username || "",
    "PRIVATE",
    symbolForContract(settings.symbol),
    settings.aiCount,
    gameCode,
    BigInt(settings.startingCash)
  );

  const handlePlay = async () => {
    const toastId = toast.loading(
      `Summoning ${settings.aiCount} AI opponent${settings.aiCount > 1 ? "s" : ""}...`
    );

    if (isGuest) {
      try {
        toast.update(toastId, { render: "Creating AI game (guest)..." });
        const res = await apiClient.post<any>("/games/create-ai-as-guest", {
          code: gameCode,
          symbol: settings.symbol,
          number_of_players: totalPlayers,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: settings.duration,
          ai_difficulty: ["easy", "hard", "boss"].includes(settings.aiDifficulty) ? settings.aiDifficulty : "boss",
          ai_difficulty_mode: settings.aiDifficultyMode === "same" ? "same" : "random",
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            starting_cash: settings.startingCash,
          },
        });
        const data = (res as any)?.data;
        const dbGameId = data?.data?.id ?? data?.id;
        if (!dbGameId) throw new Error("Backend did not return game ID");

        toast.update(toastId, {
          render: "Battle begins! Good luck, Tycoon!",
          type: "success",
          isLoading: false,
          autoClose: 5000,
        });
        router.push(board3DUrl ? `${board3DUrl}${gameCode}` : `/ai-play?gameCode=${gameCode}`);
      } catch (err: any) {
        const msg = err?.response?.data?.message ?? err?.message ?? "Failed to create AI game.";
        toast.update(toastId, { render: msg, type: "error", isLoading: false, autoClose: 8000 });
      }
      return;
    }

    if (!address || !username) {
      toast.error("Please connect your wallet and register first!", { autoClose: 5000 });
      return;
    }

    if (!contractAddress) {
      toast.error("Game contract not deployed on this network.");
      return;
    }

    // Refetch registration and username so we use current on-chain state (avoids "Not registered" / "Username mismatch")
    let registeredNow = (await refetchRegistered()).data;
    const usernameResult = await refetchUsername();
    const usernameNow = (usernameResult?.data as string | undefined) ?? username ?? "";
    if (!usernameNow.trim()) {
      toast.update(toastId, {
        render: "Could not load your on-chain username. Refresh and try again.",
        type: "error",
        isLoading: false,
        autoClose: 6000,
      });
      return;
    }
    if (registeredNow !== true) {
      // Try backend "register on-chain" (no wallet signature; backend signs as game controller)
      try {
        toast.update(toastId, { render: "Registering you on-chain (one moment)…", isLoading: true });
        const chainParam = chainName;
        const res = await apiClient.post<{ success?: boolean; alreadyRegistered?: boolean; message?: string }>(
          "/auth/register-on-chain",
          { chain: chainParam }
        );
        const data = res?.data as { success?: boolean; alreadyRegistered?: boolean; message?: string } | undefined;
        if (data?.success) {
          const { data: after } = await refetchRegistered();
          registeredNow = after;
        }
      } catch (apiErr: unknown) {
        const status = (apiErr as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          toast.update(toastId, {
            render: "Log in to your account (or create one on the home page), then try again.",
            type: "warning",
            isLoading: false,
            autoClose: 8000,
          });
          return;
        }
        if (status === 503 || status === 500) {
          const msg = (apiErr as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast.update(toastId, {
            render: msg || "Backend could not register you. Try registering on the home page with your wallet.",
            type: "error",
            isLoading: false,
            autoClose: 8000,
          });
          return;
        }
      }
      if (registeredNow !== true) {
        toast.update(toastId, {
          render: "You’re not registered on-chain. Complete registration on the home page (Register with your wallet), then try again.",
          type: "error",
          isLoading: false,
          autoClose: 8000,
        });
        return;
      }
    }

    try {
      toast.update(toastId, { render: "Creating AI game on-chain..." });
      const onChainGameId = await createAiGame(usernameNow);
      if (!onChainGameId) throw new Error("Failed to create game on-chain");

      toast.update(toastId, { render: "Saving game to server..." });

      let dbGameId: string | number | undefined;
      try {
        const saveRes: GameCreateResponse = await apiClient.post("/games", {
          id: onChainGameId,
          code: gameCode,
          mode: "PRIVATE",
          address,
          symbol: settings.symbol,
          number_of_players: totalPlayers,
          ai_opponents: settings.aiCount,
          ai_difficulty: settings.aiDifficulty,
          ai_difficulty_mode: settings.aiDifficultyMode === "same" ? "same" : "random",
          is_ai: true,
          is_minipay: isMiniPay,
          chain: chainName,
          duration: settings.duration,
          settings: {
            auction: settings.auction,
            rent_in_prison: settings.rentInPrison,
            mortgage: settings.mortgage,
            even_build: settings.evenBuild,
            starting_cash: settings.startingCash,
          },
        });

        dbGameId =
          typeof saveRes === "string" || typeof saveRes === "number"
            ? saveRes
            : saveRes?.data?.data?.id ?? saveRes?.data?.id ?? saveRes?.id;

        if (!dbGameId) throw new Error("Backend did not return game ID");
      } catch (backendError: any) {
        console.error("Backend save error:", backendError);
        throw new Error(backendError.response?.data?.message || "Failed to save game on server");
      }

      toast.update(toastId, { render: "Adding AI opponents..." });

      // Use backend endpoint to add AI players (works for wallet-created games; join endpoint requires on-chain verification)
      try {
        const addAiRes = await apiClient.post(`/games/${dbGameId}/add-ai-players`, {
          ai_count: settings.aiCount,
        });
        const resData = (addAiRes as any)?.data;
        if (!resData?.success) {
          throw new Error(resData?.message || "Failed to add AI players");
        }
      } catch (addAiErr: any) {
        console.error("Failed to add AI players:", addAiErr);
        throw new Error(
          addAiErr?.response?.data?.message || "Failed to add AI players to game"
        );
      }

      try {
        await apiClient.put(`/games/${dbGameId}`, { status: "RUNNING" });
      } catch (statusErr) {
        console.warn("Failed to set game status to RUNNING:", statusErr);
      }

      toast.update(toastId, {
        render: "Battle begins! Good luck, Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 5000,
      });

      router.push(board3DUrl ? `${board3DUrl}${gameCode}` : `/ai-play?gameCode=${gameCode}`);
    } catch (err: any) {
      console.error("handlePlay error:", err);
      const rawMessage = getContractErrorMessage(err, "Something went wrong. Please try again.");
      const message =
        typeof rawMessage === "string" && rawMessage.toLowerCase().includes("not registered")
          ? "You’re not registered on-chain. Go to the home page, connect your wallet, and complete Register (sign the transaction), then try creating an AI game again."
          : rawMessage;
      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 8000,
      });
    }
  };

  const canCreate = isGuest || (address && username && isUserRegistered);

  return {
    settings,
    setSettings,
    gameCode,
    totalPlayers,
    handlePlay,
    canCreate,
    isCreatePending,
    isGuest,
    isRegisteredLoading,
    address,
    username,
    isUserRegistered,
    contractAddress,
    registeredAgents,
    agentsLoading,
    registrySupported,
  };
}
