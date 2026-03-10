"use client";
import React, { useEffect, useState, useMemo } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2, Wallet } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { useGuestAuthOptional } from "@/context/GuestAuthContext";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";
import { useUserLevel } from "@/hooks/useUserLevel";

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  const { ready, authenticated, login, logout, user: privyUser } = usePrivy();
  const { open: openAppKit } = useAppKit();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isPrivyAuthed = ready && authenticated;

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");
  const [guestUsername, setGuestUsername] = useState("");
  const [guestPassword, setGuestPassword] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

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
      const hasOnChain = !!isUserRegistered || localRegistered;
      if (hasBackend && hasOnChain) return "fully-registered";
      if (hasBackend && !hasOnChain) return "backend-only";
      return "none";
    }
    if (guestUser) return "guest";
    if (isPrivyAuthed) return "privy";
    return "disconnected";
  }, [address, user, isUserRegistered, localRegistered, guestUser, isPrivyAuthed]);

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
    address: address ?? undefined,
    guestGameCount: guestUser ? guestGameCount : 0,
    isGuest: !!guestUser,
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
      // Register on-chain if not already
      if (!isUserRegistered && !localRegistered) {
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

      // Backend may fail with "username already exists" or "user already registered" — user is still registered on-chain; treat as success if we can load them
      const isAlreadyExists =
        err?.status === 409 ||
        err?.response?.status === 409 ||
        /already exists|already registered|username.*taken|user.*exists/i.test(err?.message ?? "");

      if (isAlreadyExists) {
        try {
          const res = await apiClient.get<ApiResponse>(`/users/by-address/${address}?chain=Celo`);
          if (res?.success && res?.data) {
            setUser(res.data as UserType);
            setLocalRegistered(true);
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
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only" || registrationStatus === "guest" || registrationStatus === "privy") && !loading && (
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
          {/* Wallet: username input for new users */}
          {address && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-[#0E1415] focus:border-cyan-500/50"
            />
          )}

          {/* When no wallet: Sign in (Privy) + Connect wallet (desktop) */}
          {!address && registrationStatus === "disconnected" && !loading && (
            <div className="w-[80%] md:w-[400px] flex flex-col gap-4 items-center">
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
                <button
                  type="button"
                  onClick={() => login()}
                  className="relative group w-full sm:w-auto min-w-[200px] h-[52px] px-8 bg-transparent border-none p-0 overflow-hidden cursor-pointer transition-transform group-hover:scale-[1.02]"
                >
                  <svg
                    width="220"
                    height="52"
                    viewBox="0 0 220 52"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-[220px] transform scale-x-[-1]"
                  >
                    <path
                      d="M10 1H210C214.373 1 216.996 6.85486 214.601 10.5127L196.167 49.5127C195.151 51.0646 193.42 52 191.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                      fill="#00F0FF"
                      stroke="#0E282A"
                      strokeWidth={2}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[16px] font-orbitron font-[700] z-2">
                    Sign in
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openAppKit()}
                  className="hidden md:flex relative group w-full sm:w-auto min-w-[200px] h-[52px] px-8 items-center justify-center rounded-xl border border-[#003B3E] bg-[#0E1415] text-[#00F0FF] font-orbitron text-[16px] font-[700] hover:border-[#00F0FF]/50 hover:bg-[#0E1415]/90 transition-all cursor-pointer"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect wallet
                </button>
              </div>
              <p className="text-[#869298] text-xs text-center font-dmSans">
                Sign in with email or social · No password
              </p>
            </div>
          )}

          {/* "Let's Go!" for wallet users (backend-only or none) */}
          {address && registrationStatus !== "fully-registered" && !loading && (
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

          {/* Action buttons: wallet registered, guest, or Privy */}
          {(address && registrationStatus === "fully-registered") || (registrationStatus === "guest" && guestUser) || registrationStatus === "privy" ? (
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

              {(guestUser || registrationStatus === "privy") && (
                <button
                  onClick={() => (registrationStatus === "privy" ? logout() : guestAuth?.logoutGuest())}
                  className="text-[#869298] hover:text-[#00F0FF] font-dmSans text-xs"
                >
                  {registrationStatus === "privy" ? "Sign out" : "Sign out (guest)"}
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
