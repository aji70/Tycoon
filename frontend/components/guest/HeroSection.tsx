"use client";
import React, { useEffect, useState, useMemo } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSignMessage } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
  useHasSmartWallet,
  useProfileOwner,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { usePrivy } from "@privy-io/react-auth";
import { useAppKit } from "@reown/appkit/react";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { useUserLevel } from "@/hooks/useUserLevel";

function chainIdToBackendChain(chainId: number): string {
  if (chainId === 137 || chainId === 80001) return "POLYGON";
  if (chainId === 42220 || chainId === 44787) return "CELO";
  if (chainId === 8453 || chainId === 84531) return "BASE";
  return "CELO";
}

const zeroAddr = "0x0000000000000000000000000000000000000000";

function isValidNonZeroAddress(a: string | null | undefined): a is `0x${string}` {
  if (!a || typeof a !== "string") return false;
  const s = a.trim();
  if (!s || s.length < 42) return false;
  if (s.toLowerCase() === zeroAddr) return false;
  return /^0x[a-fA-F0-9]{40}$/i.test(s);
}

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { open: openWallet } = useAppKit();
  const { ready, authenticated, login, logout, connectWallet, user: privyUser } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isPrivyAuthed = ready && authenticated;
  const signOutGuestAndPrivy = () => {
    guestAuth?.logoutGuest();
    if (isPrivyAuthed) void logout();
  };

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [registerOnChainLoading, setRegisterOnChainLoading] = useState(false);
  const [linkWalletLoading, setLinkWalletLoading] = useState(false);

  const {
    write: registerPlayer,
    isPending: registerPending,
  } = useRegisterPlayer();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
  } = useIsRegistered(address);

  const { data: fetchedUsername } = useGetUsername(address);

  const { data: gameCode } = usePreviousGameCode(address);

  const { data: contractGame } = useGetGameByCode(gameCode);

  const effectiveAddress = address ?? guestUser?.address ?? guestUser?.linked_wallet_address ?? undefined;
  const { data: hasSmartWalletFromChain } = useHasSmartWallet(effectiveAddress as `0x${string}` | undefined);
  const hasSmartWallet =
    (!!effectiveAddress && hasSmartWalletFromChain === true) ||
    (!!guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim() !== "");
  const smartWalletAddress = guestUser?.smart_wallet_address && String(guestUser.smart_wallet_address).trim() && guestUser.smart_wallet_address !== "0x0000000000000000000000000000000000000000"
    ? (guestUser.smart_wallet_address as `0x${string}`)
    : undefined;
  const { data: profileOwner } = useProfileOwner(smartWalletAddress);
  const needsTransferToLink = !!smartWalletAddress && !!profileOwner && profileOwner !== zeroAddr && !!address && address.toLowerCase() !== (profileOwner as string).toLowerCase();

  /** On-chain stats (incl. level) are keyed like profile: smart wallet when linked EOA is connected. */
  const connectedWalletIsLinked =
    !!guestUser &&
    !!address &&
    isValidNonZeroAddress(guestUser.linked_wallet_address ?? undefined) &&
    address.toLowerCase() === (guestUser.linked_wallet_address as string).trim().toLowerCase();
  const levelContractLookupAddress =
    connectedWalletIsLinked && smartWalletAddress ? smartWalletAddress : (address ?? undefined);

  const [backendGame, setBackendGame] = useState<{ status: string; is_ai?: boolean } | null>(null);
  const [guestLastGame, setGuestLastGame] = useState<{ code: string; status: string; is_ai?: boolean } | null>(null);
  const [guestGameCount, setGuestGameCount] = useState(0);

  useEffect(() => {
    if (!gameCode || typeof gameCode !== "string") {
      setBackendGame(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<ApiResponse>(`/games/code/${encodeURIComponent(gameCode.trim().toUpperCase())}`)
      .then((res) => {
        if (cancelled || !res?.data?.success || !res.data.data) return;
        const data = res.data.data as { status: string; is_ai?: boolean };
        setBackendGame(data);
      })
      .catch(() => {
        if (!cancelled) setBackendGame(null);
      });
    return () => {
      cancelled = true;
    };
  }, [gameCode]);

  // Guest: fetch "my games" so they can continue their last game (include is_ai for routing)
  useEffect(() => {
    if (!guestUser || address) {
      setGuestLastGame(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<ApiResponse>("/games/my-games", { params: { limit: 50 } })
      .then((res) => {
        if (cancelled || !res?.data?.success || !Array.isArray(res.data.data)) return;
        const games = res.data.data as { code: string; status: string; is_ai?: boolean }[];
        const active = games.find((g) => g.status === "RUNNING");
        setGuestLastGame(active ? { code: active.code, status: active.status, is_ai: active.is_ai } : null);
        setGuestGameCount(games.length);
      })
      .catch(() => {
        if (!cancelled) setGuestLastGame(null);
        if (!cancelled) setGuestGameCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [guestUser, address]);

  const [user, setUser] = useState<UserType | null>(null);

  // Reset on disconnect
  useEffect(() => {
    if (!address) {
      setUser(null);
      setLocalRegistered(false);
      setLocalUsername("");
      setInputUsername("");
    }
  }, [address]);

  // Fetch backend user
  useEffect(() => {
    if (!address) return;

    let isActive = true;

    const fetchUser = async () => {
      try {
        const res = await apiClient.get<ApiResponse>(
          `/users/by-address/${address}?chain=Celo`
        );

        if (!isActive) return;

        if (res.success && res.data) {
          setUser(res.data as UserType);
        } else {
          setUser(null);
        }
      } catch (error: any) {
        if (!isActive) return;
        if (error?.response?.status === 404) {
          setUser(null);
        } else {
          console.error("Error fetching user:", error);
        }
      }
    };

    fetchUser();

    return () => {
      isActive = false;
    };
  }, [address]);

  const registrationStatus = useMemo(() => {
    if (address) {
      const hasBackend = !!user;
      const hasOnChain = isUserRegistered === true;
      if (hasBackend && hasOnChain) return "fully-registered";
      if (hasBackend && !hasOnChain) return "backend-only";
      return "none";
    }
    if (guestUser || isPrivyAuthed) return "privy";
    return "disconnected";
  }, [address, user, isUserRegistered, guestUser, isPrivyAuthed]);

  const displayUsername = useMemo(() => {
    if (guestUser) return guestUser.username;
    if (isPrivyAuthed && privyUser) {
      const email = typeof privyUser.email === "string" ? privyUser.email : (privyUser.email as { address?: string })?.address;
      return email ?? "Player";
    }
    return (
      user?.username ||
      localUsername ||
      fetchedUsername ||
      inputUsername ||
      "Player"
    );
  }, [guestUser, privyUser, user, localUsername, fetchedUsername, inputUsername, isPrivyAuthed]);

  const { levelInfo } = useUserLevel({
    address: guestUser && !address ? undefined : levelContractLookupAddress,
    wagmiAddress: address,
    guestUser,
    guestLevelContext:
      guestUser && !address
        ? {
            address: guestUser.address,
            linked_wallet_address: guestUser.linked_wallet_address,
            smart_wallet_address: guestUser.smart_wallet_address,
          }
        : null,
    guestGameCount: guestUser && !address ? guestGameCount : 0,
    isGuest: !!(guestUser && !address),
  });

  // Handle registration (on-chain + backend if needed)
  const handleRegister = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    let finalUsername = inputUsername.trim();

    // If backend user exists but not on-chain → use backend username
    if (registrationStatus === "backend-only" && user?.username) {
      finalUsername = user.username.trim();
    }

    if (!finalUsername) {
      toast.warn("Please enter a username");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing registration...");

    try {
      // Register on-chain if contract doesn't have this address (required for create game / create AI game)
      if (isUserRegistered !== true) {
        await registerPlayer(finalUsername);
      }

      // Create backend user if doesn't exist
      if (!user) {
        const res = await apiClient.post<ApiResponse>("/users", {
          username: finalUsername,
          address,
          chain: "Celo",
        });

        if (!res?.success) throw new Error("Failed to save user on backend");
        setUser({ username: finalUsername } as UserType); // optimistic
      }

      // Optimistic updates
      setLocalRegistered(true);
      setLocalUsername(finalUsername);

      toast.update(toastId, {
        render: "Welcome to Tycoon!",
        type: "success",
        isLoading: false,
        autoClose: 4000,
      });

      router.refresh();
    } catch (err: any) {
      if (
        err?.code === 4001 ||
        err?.message?.includes("User rejected") ||
        err?.message?.includes("User denied")
      ) {
        toast.update(toastId, {
          render: "Transaction cancelled",
          type: "info",
          isLoading: false,
          autoClose: 3500,
        });
        return;
      }

      // Backend 409 (username taken etc.): only treat as success if contract already has this address registered
      const isAlreadyExists =
        err?.status === 409 ||
        err?.response?.status === 409 ||
        /already exists|already registered|username.*taken|user.*exists/i.test(err?.message ?? "");

      if (isAlreadyExists && isUserRegistered === true) {
        try {
          const res = await apiClient.get<ApiResponse>(`/users/by-address/${address}?chain=Celo`);
          if (res?.success && res?.data) {
            setUser(res.data as UserType);
            setLocalUsername(finalUsername);
            toast.update(toastId, {
              render: "Welcome to Tycoon!",
              type: "success",
              isLoading: false,
              autoClose: 4000,
            });
            router.refresh();
            return;
          }
        } catch (_) {
          // fall through to generic error
        }
      }
      // If 409 but contract says not registered: backend has user but chain doesn't — tell them to complete on-chain
      if (isAlreadyExists && isUserRegistered !== true) {
        toast.update(toastId, {
          render: "Complete registration: sign the transaction in your wallet to register on-chain.",
          type: "warning",
          isLoading: false,
          autoClose: 6000,
        });
        return;
      }

      let message = "Registration failed. Try again.";
      if (err?.shortMessage) message = err.shortMessage;
      if (err?.message?.includes("insufficient funds")) message = "Insufficient gas funds";

      toast.update(toastId, {
        render: message,
        type: "error",
        isLoading: false,
        autoClose: 6000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterOnChain = async () => {
    if (!guestAuth?.refetchGuest) return;
    setRegisterOnChainLoading(true);
    try {
      const res = await apiClient.post<ApiResponse>("auth/register-on-chain", { chain: "Celo" });
      if (res?.data?.success) {
        await guestAuth.refetchGuest();
        const data = res?.data as { success?: boolean; alreadyRegistered?: boolean };
        toast.success(data?.alreadyRegistered ? "Already registered" : "Registered on-chain. You can play now.");
      } else {
        toast.error((res?.data as { message?: string })?.message ?? "Registration failed");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? "Registration failed");
    } finally {
      setRegisterOnChainLoading(false);
    }
  };

  const handleLinkWallet = async () => {
    if (!address) {
      try {
        if (connectWallet) {
          connectWallet();
          toast.info("Connect your wallet in the modal, then click Connect wallet again to link");
        } else if (typeof openWallet === "function") {
          openWallet();
          toast.info("Connect your wallet in the modal, then click Connect wallet again to link");
        } else {
          toast.info("Use the connect button in the menu (top right) to connect your wallet, then click here again");
        }
      } catch {
        toast.info("Use the connect button in the menu (top right) to connect your wallet, then click here again");
      }
      return;
    }
    if (!guestUser || !guestAuth?.linkWallet) return;
    setLinkWalletLoading(true);
    try {
      const chain = chainIdToBackendChain(chainId);
      const message = `Link Tycoon account: ${guestUser.username || "Player"}`;
      const signature = await signMessageAsync({ message });
      const res = await guestAuth.linkWallet({ walletAddress: address, chain, message, signature });
      if (res.success) {
        await guestAuth.refetchGuest();
        toast.success("Wallet linked. You can play now.");
      } else {
        toast.error(res.message ?? "Link failed");
      }
    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.includes("User rejected")) {
        toast.info("Signature cancelled");
      } else {
        toast.error((err as Error)?.message ?? "Link failed");
      }
    } finally {
      setLinkWalletLoading(false);
    }
  };

  const canRegisterOnChain = !!guestUser && (!!guestUser.address || !!guestUser.linked_wallet_address);

  const handleContinuePrevious = () => {
  const code = (guestUser && guestLastGame ? guestLastGame.code : gameCode) ?? "";
  if (!code) return;

  const isAi = guestUser && guestLastGame ? guestLastGame.is_ai : (backendGame?.is_ai ?? contractGame?.ai);
  const isPending =
    (guestUser && guestLastGame && guestLastGame.status === "PENDING") ||
    (!!backendGame && backendGame.status === "PENDING");

  if (isPending) {
    router.push(`/game-waiting-3d?gameCode=${encodeURIComponent(code)}`);
    return;
  }
  if (isAi) {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    router.push(isMobile ? `/board-3d-mobile?gameCode=${encodeURIComponent(code)}` : `/board-3d?gameCode=${encodeURIComponent(code)}`);
    return;
  }
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  router.push(isMobile ? `/board-3d-multi-mobile?gameCode=${encodeURIComponent(code)}` : `/board-3d-multi?gameCode=${encodeURIComponent(code)}`);
};

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <p className="font-orbitron text-[#00F0FF] text-[16px]">
          Connecting to wallet...
        </p>
      </div>
    );
  }

  return (
    <section className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10]">
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      <div className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <h1 className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-1">
          TYCOON
        </h1>
      </div>

      <main className="w-full h-full absolute top-0 left-0 z-2 bg-transparent flex flex-col lg:justify-center items-center gap-1">
        {/* Welcome Message + Level */}
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "privy") && !loading && (
          <div className="mt-20 md:mt-28 lg:mt-0 flex flex-col items-center gap-2">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {displayUsername}!
            </p>
            {levelInfo && (
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="game-badge text-[10px] md:text-xs">LEVEL {levelInfo.level}</span>
                  <span className="game-level-label text-[10px] md:text-xs opacity-90">{levelInfo.label}</span>
                </div>
                {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                  <div className="w-32 h-1.5 rounded-full bg-[#0E282A] overflow-hidden border border-[#003B3E]/60">
                    <div
                      className="h-full rounded-full bg-[#00F0FF] transition-all duration-500"
                      style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Registering... Please wait.
            </p>
          </div>
        )}

        <div className="flex justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4">
          <TypeAnimation
            sequence={[
              "Conquer",
              1200,
              "Conquer • Build",
              1200,
              "Conquer • Build • Trade On",
              1800,
              "Play Solo vs AI",
              2000,
              "Conquer • Build",
              1000,
              "Conquer",
              1000,
              "",
              500,
            ]}
            wrapper="span"
            speed={40}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        <h1 className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative">
          TYCOON
          <span className="absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        <div className="w-full px-4 md:w-[70%] lg:w-[55%] text-center text-[#F0F7F7] -tracking-[2%]">
          <TypeAnimation
            sequence={[
              "Roll the dice",
              2000,
              "Buy properties",
              2000,
              "Collect rent",
              2000,
              "Play against AI opponents",
              2200,
              "Become the top tycoon",
              2000,
            ]}
            wrapper="span"
            speed={50}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
          <p className="font-dmSans font-[400] md:text-[18px] text-[14px] text-[#F0F7F7] mt-4">
            Step into Tycoon — the Web3 twist on the classic game of strategy,
            ownership, and fortune. Play solo against AI, compete in multiplayer
            rooms, collect tokens, complete quests, and become the ultimate
            blockchain tycoon.
          </p>
        </div>

        <div className="z-1 w-full flex flex-col justify-center items-center mt-6 gap-4">
          {/* EOA mandatory Privy: wallet connected but not signed in with Privy — must sign in with Privy to continue */}
          {address && !isPrivyAuthed && !loading && (
            <div className="w-[80%] md:w-[400px] flex flex-col gap-4 items-center">
              <p className="text-[#869298] text-sm text-center font-dmSans">
                Sign in with Privy to continue
              </p>
              <button
                type="button"
                onClick={() => login()}
                className="relative group w-full sm:w-auto min-w-[220px] h-[52px] px-8 bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-[1.02]"
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[260px] transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={2}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-[700] z-2">
                  Sign in with Privy
                </span>
              </button>
            </div>
          )}

          {/* Wallet: username input for new users (only when Privy-authed) */}
          {address && isPrivyAuthed && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0E1415] focus:border-cyan-500/50"
            />
          )}

          {/* When disconnected: "Let's Go!" = Sign in with email only (Privy). Wallet can be added after sign-in in Profile. */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-[80%] md:w-[400px] flex flex-col gap-4 items-center">
              <button
                type="button"
                onClick={() => login()}
                className="relative group w-full sm:w-auto min-w-[220px] h-[52px] px-8 bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-[1.02]"
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[260px] transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={2}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] font-orbitron font-[700] z-2">
                  Let&apos;s Go!
                </span>
              </button>
              <p className="text-[#869298] text-xs text-center font-dmSans">
                Sign in with email · Add a wallet later in Profile if you want
              </p>
            </div>
          )}

          {/* "Let's Go!" for wallet users (backend-only or none) — only when Privy-authed */}
          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (
            <button
              onClick={handleRegister}
              disabled={
                loading ||
                registerPending ||
                (registrationStatus === "none" && !inputUsername.trim())
              }
              className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
            >
              <svg
                width="260"
                height="52"
                viewBox="0 0 260 52"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
              >
                <path
                  d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth={1}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-2">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
          )}
          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (
            <p className="text-[#869298] text-xs text-center font-dmSans -mt-1">
              Creates your game account &amp; smart wallet
            </p>
          )}

          {/* Register + Link wallet: when Privy/guest without smart wallet — hide when action buttons are shown */}
          {(registrationStatus === "privy" || (address && isPrivyAuthed && registrationStatus === "fully-registered" && !hasSmartWallet)) && !hasSmartWallet && (guestUser || isPrivyAuthed) && !loading && !((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) && (
            <div className="flex flex-col items-center gap-4 mt-4">
              <p className="text-[#869298] text-sm text-center max-w-sm">
                Register or link a wallet to unlock Challenge AI, Multiplayer, and Join Room.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {canRegisterOnChain && (
                  <button
                    type="button"
                    onClick={handleRegisterOnChain}
                    disabled={registerOnChainLoading}
                    className="relative group w-[200px] h-[44px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
                  >
                    <svg width="200" height="44" viewBox="0 0 200 44" fill="none" className="absolute inset-0 w-full h-full">
                      <path d="M8 1H192C196.418 1 198.997 5.85486 196.601 9.5127L178.167 39.5127C177.151 41.0646 175.42 42 173.565 42H8C4.96243 42 2.5 39.5376 2.5 36.5V8.5C2.5 5.46243 4.96243 3 8 3Z" fill="#00F0FF" stroke="#0E282A" strokeWidth={1} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-sm font-orbitron font-[700] z-2">
                      {registerOnChainLoading ? "Registering..." : "Register"}
                    </span>
                  </button>
                )}
                {needsTransferToLink && (
                  <p className="text-amber-300/90 text-xs text-center max-w-[280px]">
                    Transfer profile first: open Profile and use &quot;Transfer profile to address&quot; with this wallet, then link here.
                  </p>
                )}
                <button
                  type="button"
                  onClick={needsTransferToLink ? () => { router.push("/profile"); toast.info("Use Transfer profile to address with your current wallet, then come back and Link."); } : handleLinkWallet}
                  disabled={linkWalletLoading}
                  className="relative group w-[200px] h-[44px] bg-transparent border-none p-0 overflow-hidden cursor-pointer disabled:opacity-60"
                >
                  <svg width="200" height="44" viewBox="0 0 200 44" fill="none" className="absolute inset-0 w-full h-full">
                    <path d="M8 1H192C196.418 1 198.997 5.85486 196.601 9.5127L178.167 39.5127C177.151 41.0646 175.42 42 173.565 42H8C4.96243 42 2.5 39.5376 2.5 36.5V8.5C2.5 5.46243 4.96243 3 8 3Z" fill="#003B3E" stroke="#00F0FF" strokeWidth={1} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] text-sm font-orbitron font-[700] z-2">
                    {linkWalletLoading ? "Linking..." : needsTransferToLink ? "Go to Profile" : address ? "Link wallet" : "Connect wallet"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Action buttons: require Privy for EOA; guest/Privy. Show when fully set up (hasSmartWallet preferred, but allow linked/registered users to try). */}
          {((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) ? (
            <div className="flex flex-wrap justify-center items-center gap-4">
              {/* Continue Previous Game - Highlighted (wallet: from contract; guest: from my-games) */}
              {((address && gameCode && (contractGame?.status == 1) && (!backendGame || (backendGame.status !== "FINISHED" && backendGame.status !== "COMPLETED" && backendGame.status !== "CANCELLED"))) ||
                (guestUser && guestLastGame && guestLastGame.status !== "COMPLETED" && guestLastGame.status !== "CANCELLED")) && (
                <button
                  onClick={handleContinuePrevious}
                  className="relative group w-[300px] h-[56px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-105"
                >
                  <svg
                    width="300"
                    height="56"
                    viewBox="0 0 300 56"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] group-hover:animate-pulse"
                  >
                    <path
                      d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                      fill="#00F0FF"
                      stroke="#0E282A"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[20px] font-orbitron font-[700] z-2">
                    <Gamepad2 className="mr-2 w-7 h-7" />
                    Continue Game
                  </span>
                </button>
              )}

              {/* Play with Friends */}
              <button
                onClick={() => router.push("/game-settings-3d")}
                className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="227"
                  height="40"
                  viewBox="0 0 227 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                >
                  <path
                    d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#003B3E"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Gamepad2 className="mr-1.5 w-[16px] h-[16px]" />
                  Multiplayer
                </span>
              </button>

              {/* Join Room */}
              <button
                onClick={() => router.push("/join-room-3d")}
                className="relative group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
              >
                <svg
                  width="140"
                  height="40"
                  viewBox="0 0 140 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full"
                >
                  <path
                    d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                    fill="#0E1415"
                    stroke="#003B3E"
                    strokeWidth={1}
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Dices className="mr-1.5 w-[16px] h-[16px]" />
                  Join Room
                </span>
              </button>

              {(guestUser || isPrivyAuthed) && (
                <button
                  type="button"
                  onClick={() => signOutGuestAndPrivy()}
                  className="text-[#869298] hover:text-[#00F0FF] font-dmSans text-xs"
                >
                  Sign out
                </button>
              )}

              {/* Challenge AI */}
              <button
                onClick={() => router.push("/play-ai-3d")}
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform duration-300 group-hover:scale-105"
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] group-hover:animate-pulse"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
                  Challenge AI!
                </span>
              </button>

              {/* Agent Battles */}
              <button
                onClick={() => router.push("/arena")}
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform duration-300 group-hover:scale-105"
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#003B3E"
                    stroke="#00F0FF"
                    strokeWidth={1}
                    className="group-hover:stroke-[#0FF0FC] transition-all duration-300"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
                  Agent Battles
                </span>
              </button>
            </div>
          ) : null}

          {!address && !guestUser && !isPrivyAuthed && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Sign in or connect your wallet to play.
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;
