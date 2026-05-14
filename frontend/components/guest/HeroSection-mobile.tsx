"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
import { ParticleBackground } from "@/components/hero/ParticleBackground";
import { ScanlineOverlay } from "@/components/hero/ScanlineOverlay";
import { HUDLevelBadge } from "@/components/hero/HUDLevelBadge";
import { NeonTitle } from "@/components/hero/NeonTitle";
import { GlowButton } from "@/components/hero/GlowButton";
import { WorldStatsBar } from "@/components/hero/WorldStatsBar";

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
  const needsTransferToLink = !!smartWalletAddress && !!profileOwner && profileOwner !== zeroAddr && !!address && address.toLowerCase() !== (profileOwner as string).toLowerCase();

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
  const parallaxRef = useRef<HTMLDivElement>(null);

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

  // Parallax mouse tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
    <section
      ref={parallaxRef}
      className="relative w-full min-h-screen min-h-[100dvh] bg-[#010F10] overflow-hidden z-0"
    >
      {/* Background Image - no parallax on mobile */}
      <motion.div
        className="absolute inset-0"
        animate={{}}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Image
          src={herobg}
          alt="Hero Background"
          fill
          className="object-cover object-center hero-bg-zoom"
          priority
          fetchPriority="high"
          quality={78}
          sizes="100vw"
        />
      </motion.div>

      {/* Particle effects */}
      <ParticleBackground />

      {/* Scanline and grid overlay */}
      <ScanlineOverlay />

      {/* Gradient overlay for readability on mobile */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#010F10]/40 via-transparent to-[#010F10]/90 z-5" aria-hidden />

      {/* Content Container - safe area for notches & home indicator */}
      <div className="relative z-20 flex flex-col items-center px-4 sm:px-5 pt-[calc(env(safe-area-inset-top)+8rem)] pb-[max(env(safe-area-inset-bottom),8rem)] min-h-screen min-h-[100dvh]">
        {/* Title - Neon effect for mobile */}
        <div className="relative w-full flex justify-center mt-0 sm:mt-2">
          <NeonTitle text="TYCOON" size="md" />
        </div>

        {/* Welcome / Loading message + Enhanced Level */}
        <div className="mt-3 sm:mt-4 text-center px-2 flex flex-col items-center gap-2">
          {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "privy") && !loading && (
            <>
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="font-orbitron text-base sm:text-lg font-bold text-[#00F0FF]"
              >
                Welcome back, {displayUsername}!
              </motion.p>
              {levelInfo && (
                <div className="scale-75 sm:scale-100 origin-top">
                  <HUDLevelBadge
                    level={levelInfo.level}
                    label={levelInfo.label}
                    progress={levelInfo.progress}
                    maxXp={levelInfo.xpForNextLevel || 100}
                    currentXp={levelInfo.currentXp || 0}
                  />
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

        {/* Main action area — min-height avoids CLS when Privy / registration UI hydrates */}
        <div className="mt-4 sm:mt-6 w-full max-w-[380px] flex min-h-[100px] flex-col items-center gap-5 sm:gap-6 flex-1">
          {/* EOA mandatory Privy: wallet connected but not signed in with Privy */}
          {address && !isPrivyAuthed && !loading && (
            <div className="w-full flex flex-col gap-3 items-center">
              <p className="text-[#869298] text-sm text-center font-dmSans">
                Sign in with Privy to continue
              </p>
              <GlowButton
                onClick={() => login()}
                variant="primary"
                size="lg"
              >
                Sign in with Privy
              </GlowButton>
            </div>
          )}

          {address && isPrivyAuthed && registrationStatus === "none" && !loading && (
            <motion.input
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-full h-12 bg-[#0E1415]/80 backdrop-blur-sm rounded-xl border-2 border-[#003B3E] outline-none px-5 text-[#17ffff] font-orbitron text-base text-center placeholder:text-[#6B8A8F] placeholder:font-dmSans focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0E1415] focus:border-cyan-500 transition-colors duration-300"
            />
          )}

          {/* When disconnected: "Let's Go!" = Sign in with email only (Privy). Wallet can be added after sign-in in Profile. */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-full flex flex-col gap-3 items-center">
              <GlowButton
                onClick={() => login()}
                variant="primary"
                size="lg"
              >
                Let&apos;s Go!
              </GlowButton>
              <p className="text-[#869298] text-xs text-center font-dmSans px-2">
                Sign in with email · Add a wallet later in Profile if you want
              </p>
            </div>
          )}

          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (
            <>
              <GlowButton
                onClick={handleRegister}
                disabled={loading || registerPending || (registrationStatus === "none" && !inputUsername.trim())}
                variant="primary"
                size="lg"
              >
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </GlowButton>
              <p className="text-[#869298] text-xs text-center font-dmSans -mt-1 px-2">
                Creates your game account &amp; smart wallet
              </p>
            </>
          )}

          {/* Register + Link wallet: hide when action buttons are shown */}
          {(registrationStatus === "privy" || (address && isPrivyAuthed && registrationStatus === "fully-registered" && !hasSmartWallet)) && !hasSmartWallet && (guestUser || isPrivyAuthed) && !loading && !((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4 mt-4"
            >
              <p className="text-[#869298] text-sm text-center px-2 max-w-sm">
                Register or link a wallet to unlock Challenge AI, Multiplayer, and Join Room.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mb-4">
                {canRegisterOnChain && (
                  <GlowButton
                    onClick={handleRegisterOnChain}
                    disabled={registerOnChainLoading}
                    variant="primary"
                    size="sm"
                  >
                    {registerOnChainLoading ? "Registering..." : "Register"}
                  </GlowButton>
                )}
                {needsTransferToLink && (
                  <p className="text-amber-300/90 text-xs text-center max-w-[280px]">
                    Transfer profile first: open Profile and use &quot;Transfer profile to address&quot; with this wallet, then link here.
                  </p>
                )}
                <GlowButton
                  onClick={needsTransferToLink ? () => { router.push("/profile"); toast.info("Use Transfer profile to address with your current wallet, then come back and Link."); } : handleLinkWallet}
                  disabled={linkWalletLoading}
                  variant="secondary"
                  size="sm"
                >
                  {linkWalletLoading ? "Linking..." : needsTransferToLink ? "Go to Profile" : address ? "Link wallet" : "Connect wallet"}
                </GlowButton>
              </div>
            </motion.div>
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
                  className="relative w-[130px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                >
                  <svg
                    width="130"
                    height="40"
                    viewBox="0 0 130 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H124C128.373 1 130.996 5.85486 128.601 9.5127L110.167 37.5127C109.151 39.0646 107.42 40 105.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
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

                <button
                  onClick={() => router.push("/join-room-3d")}
                  className="relative w-[130px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer group"
                >
                  <svg
                    width="130"
                    height="40"
                    viewBox="0 0 130 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H124C128.373 1 130.996 5.85486 128.601 9.5127L110.167 37.5127C109.151 39.0646 107.42 40 105.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#003B3E"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
                    <Dices className="mr-1.5 w-[16px] h-[16px]" />
                    Join Room
                  </span>
                </button>
              </div>

              {/* Challenge AI */}
              <GlowButton
                onClick={() => router.push("/play-ai-3d")}
                variant="primary"
                size="md"
              >
                Challenge AI
              </GlowButton>

              {/* Agent Battles */}
              <GlowButton
                onClick={() => router.push("/arena")}
                variant="secondary"
                size="md"
              >
                Agent Battles
              </GlowButton>
            </div>
          ) : null}

          {!address && !guestUser && !isPrivyAuthed && !loading && (
            <p className="text-gray-400 text-sm text-center mt-4 px-2">
              Sign in or connect your wallet (menu) to play.
            </p>
          )}
        </div>
      </div>

      {/* World Stats Bar */}
      <WorldStatsBar
        playersOnline={1234}
        propertiesOwned={5678}
        tokensInPlay="12.5M"
      />
    </section>
  );
};

export default HeroSectionMobile;
