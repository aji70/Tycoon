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

const HeroSectionMobile: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { open: openWallet } = useAppKit();
  const { ready, authenticated, login, logout, connectWallet, user: privyUser } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isPrivyAuthed = ready && authenticated;

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [registerOnChainLoading, setRegisterOnChainLoading] = useState(false);
  const [linkWalletLoading, setLinkWalletLoading] = useState(false);

  const { write: registerPlayer, isPending: registerPending } = useRegisterPlayer();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
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
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const needsTransferToLink = !!smartWalletAddress && !!profileOwner && profileOwner !== zeroAddr && !!address && address.toLowerCase() !== (profileOwner as string).toLowerCase();

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
        const res = await apiClient.get<ApiResponse>(`/users/by-address/${address}?chain=Celo`);

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
    return user?.username || localUsername || fetchedUsername || inputUsername || "Player";
  }, [guestUser, privyUser, user, localUsername, fetchedUsername, inputUsername, isPrivyAuthed]);

  const { levelInfo } = useUserLevel({
    address: address ?? undefined,
    guestGameCount: guestUser ? guestGameCount : 0,
    isGuest: !!guestUser,
  });

  const handleRegister = async () => {
    if (!address) {
      toast.error("Please connect your wallet");
      return;
    }

    let finalUsername = inputUsername.trim();

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
      if (isUserRegistered !== true) {
        await registerPlayer(finalUsername);
      }

      if (!user) {
        const res = await apiClient.post<ApiResponse>("/users", {
          username: finalUsername,
          address,
          chain: "Celo",
        });

        if (!res?.success) throw new Error("Failed to save user on backend");
        setUser({ username: finalUsername } as UserType);
      }

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
      if (err?.code === 4001 || err?.message?.includes("User rejected")) {
        toast.update(toastId, {
          render: "Transaction cancelled",
          type: "info",
          isLoading: false,
          autoClose: 3500,
        });
        return;
      }

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
        } catch (_) {}
      }
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(e?.response?.data?.message ?? e?.message ?? "Registration failed");
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
          toast.info("Open the menu to connect your wallet, then click here again");
        }
      } catch {
        toast.info("Open the menu to connect your wallet, then click here again");
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
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e?.code === 4001 || e?.message?.includes("User rejected")) {
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
    router.push(`/board-3d-mobile?gameCode=${encodeURIComponent(code)}`);
    return;
  }
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  router.push(isMobile ? `/board-3d-multi-mobile?gameCode=${encodeURIComponent(code)}` : `/board-3d-multi?gameCode=${encodeURIComponent(code)}`);
};

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#010F10]">
        <p className="font-orbitron text-[#00F0FF] text-lg">Connecting to wallet...</p>
      </div>
    );
  }

  return (
    <section className="relative w-full min-h-screen min-h-[100dvh] bg-[#010F10] overflow-x-hidden z-0">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={herobg}
          alt="Hero Background"
          fill
          className="object-cover object-center hero-bg-zoom"
          priority
          quality={90}
          sizes="100vw"
        />
        {/* Gradient overlay for readability on mobile */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#010F10]/40 via-transparent to-[#010F10]/90" aria-hidden />
      </div>

      {/* Content Container - safe area for notches & home indicator */}
      <div className="relative z-10 flex flex-col items-center px-4 sm:px-5 pt-[calc(env(safe-area-inset-top)+5rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)] min-h-screen min-h-[100dvh]">
        {/* Title - wrapped so "?" doesn't overflow on narrow screens */}
        <div className="relative w-full flex justify-center mt-4 sm:mt-8">
          <h1 className="font-orbitron font-black text-5xl sm:text-6xl md:text-7xl leading-none uppercase text-[#17ffff] tracking-[-0.02em] text-center drop-shadow-[0_0_20px_rgba(0,240,255,0.2)]">
            TYCOON
            <span className="inline-block ml-1 sm:ml-2 text-[#0FF0FC] font-dmSans font-bold text-2xl sm:text-3xl rotate-12 animate-pulse drop-shadow-lg align-top">?</span>
          </h1>
        </div>

        {/* Welcome / Loading message + Level */}
        <div className="mt-5 sm:mt-6 text-center px-2 flex flex-col items-center gap-2">
          {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "privy") && !loading && (
            <>
              <p className="font-orbitron text-lg sm:text-xl font-bold text-[#00F0FF]">
                Welcome back, {displayUsername}!
              </p>
              {levelInfo && (
                <div className="flex flex-col items-center gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="game-badge text-xs">LEVEL {levelInfo.level}</span>
                    <span className="game-level-label text-xs opacity-90">{levelInfo.label}</span>
                  </div>
                  {levelInfo.level < 99 && levelInfo.xpForNextLevel > 0 && (
                    <div className="w-28 h-1.5 rounded-full bg-[#0E282A] overflow-hidden border border-[#003B3E]/60">
                      <div
                        className="h-full rounded-full bg-[#00F0FF] transition-all duration-500"
                        style={{ width: `${Math.round(levelInfo.progress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {loading && (
            <p className="font-orbitron text-lg sm:text-xl font-bold text-[#00F0FF]">
              Registering... Please wait
            </p>
          )}
        </div>

        {/* Animated phrase */}
        <div className="mt-4 sm:mt-5 px-2 min-h-[2.5rem] flex items-center justify-center">
          <TypeAnimation
            sequence={[
              "Conquer", 1200,
              "Conquer • Build", 1200,
              "Conquer • Build • Trade", 1800,
              "Play Solo vs AI", 2000,
              "Conquer • Build", 1000,
              "Conquer", 1000,
              "", 500,
            ]}
            wrapper="span"
            speed={45}
            repeat={Infinity}
            className="font-orbitron text-xl sm:text-2xl md:text-3xl font-bold text-[#F0F7F7] text-center block"
          />
        </div>

        {/* Short description */}
        <p className="mt-5 sm:mt-6 text-center text-[#DDEEEE] text-[15px] sm:text-base leading-relaxed max-w-[340px] font-dmSans px-1">
          Roll the dice • Buy properties • Collect rent •
          Play against AI • Become the top tycoon
        </p>

        {/* Main action area */}
        <div className="mt-8 sm:mt-10 w-full max-w-[380px] flex flex-col items-center gap-5 sm:gap-6 flex-1">
          {/* EOA mandatory Privy: wallet connected but not signed in with Privy */}
          {address && !isPrivyAuthed && !loading && (
            <div className="w-full max-w-[300px] flex flex-col gap-3 items-center">
              <p className="text-[#869298] text-sm text-center font-dmSans">
                Sign in with Privy to continue
              </p>
              <button
                type="button"
                onClick={() => login()}
                className="relative w-full max-w-[260px] h-14 overflow-hidden rounded-xl transition-transform active:scale-[0.98]"
              >
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 260 56"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth="2"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-base font-orbitron font-bold z-0">
                  Sign in with Privy
                </span>
              </button>
            </div>
          )}

          {address && isPrivyAuthed && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-full h-12 bg-[#0E1415]/80 backdrop-blur-sm rounded-xl border border-[#004B4F] outline-none px-5 text-[#17ffff] font-orbitron text-base text-center placeholder:text-[#6B8A8F] placeholder:font-dmSans focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0E1415] focus:border-cyan-500/50"
            />
          )}

          {/* When disconnected: "Let's Go!" = Sign in with email only (Privy). Wallet can be added after sign-in in Profile. */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-full max-w-[300px] flex flex-col gap-3 items-center">
              <button
                type="button"
                onClick={() => login()}
                className="relative w-full max-w-[260px] h-14 overflow-hidden rounded-xl transition-transform active:scale-[0.98]"
              >
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 260 56"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth="2"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-base font-orbitron font-bold z-0">
                  Let&apos;s Go!
                </span>
              </button>
              <p className="text-[#869298] text-xs text-center font-dmSans px-2">
                Sign in with email · Add a wallet later in Profile if you want
              </p>
            </div>
          )}

          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (
            <>
            <button
              onClick={handleRegister}
              disabled={loading || registerPending || (registrationStatus === "none" && !inputUsername.trim())}
              className="relative w-full h-14 disabled:opacity-60 transition-transform active:scale-[0.98]"
            >
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 300 56"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth="2"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-lg font-orbitron font-bold z-0">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
              <p className="text-[#869298] text-xs text-center font-dmSans -mt-1 px-2">
                Creates your game account &amp; smart wallet
              </p>
            </>
          )}

          {/* Register + Link wallet: hide when action buttons are shown */}
          {(registrationStatus === "privy" || (address && isPrivyAuthed && registrationStatus === "fully-registered" && !hasSmartWallet)) && !hasSmartWallet && (guestUser || isPrivyAuthed) && !loading && !((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) && (
            <div className="flex flex-col items-center gap-4 mt-4">
              <p className="text-[#869298] text-sm text-center px-2 max-w-sm">
                Register or link a wallet to unlock Challenge AI, Multiplayer, and Join Room.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {canRegisterOnChain && (
                  <button
                    type="button"
                    onClick={handleRegisterOnChain}
                    disabled={registerOnChainLoading}
                    className="relative w-[160px] h-12 overflow-hidden rounded-xl disabled:opacity-60"
                  >
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 48" fill="none">
                      <path d="M6 1H154C158.418 1 160.997 5.85486 158.601 9.5127L140.167 39.5127C139.151 41.0646 137.42 42 135.565 42H6C2.96243 42 0.5 39.5376 0.5 36.5V8.5C0.5 5.46243 2.96243 3 6 3Z" fill="#00F0FF" stroke="#0E282A" strokeWidth={1} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-sm font-orbitron font-bold z-0">
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
                  className="relative w-[160px] h-12 overflow-hidden rounded-xl disabled:opacity-60"
                >
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 48" fill="none">
                    <path d="M6 1H154C158.418 1 160.997 5.85486 158.601 9.5127L140.167 39.5127C139.151 41.0646 137.42 42 135.565 42H6C2.96243 42 0.5 39.5376 0.5 36.5V8.5C0.5 5.46243 2.96243 3 6 3Z" fill="#003B3E" stroke="#00F0FF" strokeWidth={1} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] text-sm font-orbitron font-bold z-0">
                    {linkWalletLoading ? "Linking..." : needsTransferToLink ? "Go to Profile" : address ? "Link wallet" : "Connect wallet"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) ? (
            <div className="w-full flex flex-col items-center gap-5">
              {/* Continue Previous Game - prominent when available, not full width */}
              {((gameCode && (contractGame?.status == 1) && (!backendGame || (backendGame.status !== "FINISHED" && backendGame.status !== "COMPLETED" && backendGame.status !== "CANCELLED"))) ||
                (guestUser && guestLastGame && guestLastGame.status !== "COMPLETED" && guestLastGame.status !== "CANCELLED")) && (
                <button
                  onClick={handleContinuePrevious}
                  className="relative w-full max-w-[280px] h-12 transition-transform active:scale-[0.98]"
                >
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 300 56"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                      fill="#00F0FF"
                      stroke="#0E282A"
                      strokeWidth="2.5"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-sm font-orbitron font-bold gap-2">
                    <Gamepad2 size={18} />
                    Continue Game
                  </span>
                </button>
              )}

              {/* Secondary buttons grid */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
                <button
                  onClick={() => router.push("/game-settings-3d")}
                  className="relative h-12 transition-transform active:scale-[0.97]"
                >
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 227 48"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#003B3E"
                      stroke="#004B4F"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] text-xs font-medium gap-1.5">
                    <Gamepad2 size={16} />
                    Multiplayer
                  </span>
                </button>

                <button
                  onClick={() => router.push("/join-room-3d")}
                  className="relative h-12 transition-transform active:scale-[0.97]"
                >
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 140 48"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#0E1415"
                      stroke="#004B4F"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] text-xs font-medium gap-1.5">
                    <Dices size={16} />
                    Join
                  </span>
                </button>
              </div>

              {/* Challenge AI - prominent but not full width */}
              <button
                onClick={() => router.push("/play-ai-3d")}
                className="relative w-full max-w-[280px] h-12 transition-transform active:scale-[0.98]"
              >
                <svg
                  className="absolute inset-0 w-full h-full"
                  viewBox="0 0 300 56"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M12 1H288C293.373 1 296 7.85486 293.601 12.5127L270.167 54.5127C269.151 56.0646 267.42 57 265.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth="2.5"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-sm font-orbitron font-bold uppercase">
                  Challenge AI!
                </span>
              </button>
              {(guestUser || isPrivyAuthed) && (
                <button
                  onClick={() => (isPrivyAuthed ? logout() : guestAuth?.logoutGuest())}
                  className="text-[#869298] hover:text-[#00F0FF] font-dmSans text-xs"
                >
                  Sign out
                </button>
              )}
            </div>
          ) : null}

          {!address && !guestUser && !isPrivyAuthed && !loading && (
            <p className="text-gray-400 text-sm text-center mt-4 px-2">
              Sign in or connect your wallet (menu) to play.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSectionMobile;
