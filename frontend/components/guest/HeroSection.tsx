"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount, useChainId, useSignMessage, usePublicClient } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
  useHasSmartWallet,
  useProfileOwner,
} from "@/context/ContractProvider";
import { isMiniPayEmbeddedWallet } from "@/lib/minipayGuestFlow";
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

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { open: openWallet } = useAppKit();
  const publicClient = usePublicClient();
  const isMiniPay = typeof window !== "undefined" && isMiniPayEmbeddedWallet();
  const { ready, authenticated, login, logout, connectWallet, user: privyUser } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  // MiniPay injects its own wallet — treat as authed even without Privy session
  const isPrivyAuthed = (ready && authenticated) || isMiniPay;
  const signOutGuestAndPrivy = () => {
    guestAuth?.logoutGuest();
    if (isPrivyAuthed) void logout();
  };

  const [isMobile, setIsMobile] = useState(false);
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
    refetch: refetchIsRegistered,
  } = useIsRegistered(address);

  const { data: fetchedUsername, refetch: refetchUsername } = useGetUsername(address);

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
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
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

  // Detect mobile and disable parallax for better performance
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Parallax mouse tracking - disabled on mobile
  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      setMousePosition({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMobile]);

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
        const txHash = await registerPlayer(finalUsername);
        if (txHash && publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
        }
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

      // Refetch to update UI
      if (refetchIsRegistered) refetchIsRegistered();
      if (refetchUsername) refetchUsername();

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
            // Refetch to update UI
            if (refetchIsRegistered) refetchIsRegistered();
            if (refetchUsername) refetchUsername();
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
    <section
      ref={parallaxRef}
      className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-hidden bg-[#010F10]"
    >
      {/* Background with parallax - disabled on mobile */}
      <motion.div
        className="w-full h-full overflow-hidden absolute inset-0"
        animate={
          isMobile
            ? {}
            : {
                x: mousePosition.x * 10,
                y: mousePosition.y * 10,
              }
        }
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover"
          width={1440}
          height={1024}
          priority
          fetchPriority="high"
          sizes="100vw"
          quality={80}
        />
      </motion.div>

      {/* Particle effects */}
      <ParticleBackground />

      {/* Scanline and grid overlay */}
      <ScanlineOverlay />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#010F10]/20 to-[#010F10]/60 z-5" />

      <main className="w-full h-full absolute top-0 left-0 z-20 bg-transparent flex flex-col lg:justify-start md:justify-center justify-start items-center gap-1 px-4 pt-8 md:pt-0 lg:pt-16">
        {/* Welcome Message + Enhanced HUD Level */}
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "privy") && !loading && (
          <div className="mt-20 md:mt-28 lg:mt-0 flex flex-col items-center gap-4">
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center"
            >
              Welcome back, {displayUsername}!
            </motion.p>
            {levelInfo && (
              <HUDLevelBadge
                level={levelInfo.level}
                label={levelInfo.label}
                progress={levelInfo.progress}
                maxXp={levelInfo.xpForNextLevel || 100}
                currentXp={levelInfo.currentXp || 0}
              />
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

        <NeonTitle text="TYCOON" size="lg" />

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

        <div className="z-1 w-full flex min-h-[60px] flex-col justify-center items-center mt-2 gap-4">
          {/* EOA mandatory Privy: wallet connected but not signed in with Privy — must sign in with Privy to continue */}
          {address && !isPrivyAuthed && !loading && (
            <div className="w-full flex flex-col gap-4 items-center">
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

          {/* Wallet: username input for new users (only when Privy-authed) */}
          {address && isPrivyAuthed && registrationStatus === "none" && !loading && (
            <motion.input
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[2px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0E1415] focus:border-cyan-500 transition-colors duration-300"
            />
          )}

          {/* When disconnected: "Let's Go!" = Sign in with email only (Privy). Wallet can be added after sign-in in Profile. */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-full flex flex-col gap-4 items-center">
              <GlowButton
                onClick={() => login()}
                variant="primary"
                size="lg"
              >
                Let&apos;s Go!
              </GlowButton>
              <p className="text-[#869298] text-xs text-center font-dmSans">
                Sign in with email · Add a wallet later in Profile if you want
              </p>
            </div>
          )}

          {/* "Let's Go!" for wallet users (backend-only or none) — only when Privy-authed */}
          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (() => {
            const isDisabled = loading || registerPending || (registrationStatus === "none" && !inputUsername.trim());
            return (
              <GlowButton
                onClick={handleRegister}
                disabled={isDisabled}
                variant="primary"
                size="lg"
                glow={!isDisabled}
              >
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </GlowButton>
            );
          })()}
          {address && isPrivyAuthed && registrationStatus !== "fully-registered" && !loading && (
            <p className="text-[#869298] text-xs text-center font-dmSans -mt-1">
              Creates your game account &amp; smart wallet
            </p>
          )}

          {/* Register + Link wallet: when Privy/guest without smart wallet — hide when action buttons are shown */}
          {(registrationStatus === "privy" || (address && isPrivyAuthed && registrationStatus === "fully-registered" && !hasSmartWallet)) && !hasSmartWallet && (guestUser || isPrivyAuthed) && !loading && !((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center gap-4 mt-4"
            >
              <p className="text-[#869298] text-sm text-center max-w-sm">
                Register or link a wallet to unlock Challenge AI, Multiplayer, and Join Room.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
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

          {/* Action buttons: require Privy for EOA; guest/Privy. Show when fully set up (hasSmartWallet preferred, but allow linked/registered users to try). */}
          {((address && registrationStatus === "fully-registered" && isPrivyAuthed) || (registrationStatus === "privy" && (guestUser || isPrivyAuthed))) ? (
            <div className="flex flex-wrap justify-center items-center gap-4">
              {/* Continue Previous Game - Highlighted (wallet: from contract; guest: from my-games) */}
              {((address && gameCode && (contractGame?.status == 1) && (!backendGame || (backendGame.status !== "FINISHED" && backendGame.status !== "COMPLETED" && backendGame.status !== "CANCELLED"))) ||
                (guestUser && guestLastGame && guestLastGame.status !== "COMPLETED" && guestLastGame.status !== "CANCELLED")) && (
                <GlowButton
                  onClick={handleContinuePrevious}
                  variant="primary"
                  size="lg"
                  icon={<Gamepad2 className="w-5 h-5" />}
                >
                  Continue Game
                </GlowButton>
              )}

              {/* Play with Friends */}
              <GlowButton
                onClick={() => router.push("/game-settings-3d")}
                variant="secondary"
                size="sm"
                icon={<Gamepad2 className="w-4 h-4" />}
              >
                Multiplayer
              </GlowButton>

              {/* Join Room */}
              <GlowButton
                onClick={() => router.push("/join-room-3d")}
                variant="tertiary"
                size="sm"
                icon={<Dices className="w-4 h-4" />}
              >
                Join Room
              </GlowButton>

              {/* Challenge AI */}
              <GlowButton
                onClick={() => router.push("/play-ai-3d")}
                variant="primary"
                size="lg"
              >
                Challenge AI
              </GlowButton>

              {/* Agent Battles */}
              <GlowButton
                onClick={() => router.push("/arena")}
                variant="secondary"
                size="lg"
              >
                Agent Battles
              </GlowButton>
            </div>
          ) : null}

          {!address && !guestUser && !isPrivyAuthed && (
            <p className="text-gray-400 text-sm text-center mt-4">
              Sign in or connect your wallet to play.
            </p>
          )}
        </div>
      </main>

      {/* World Stats Bar */}
      <WorldStatsBar
        playersOnline={1234}
        propertiesOwned={5678}
        tokensInPlay="12.5M"
      />
    </section>
  );
};

export default HeroSection;
