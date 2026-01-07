"use client";
import React, { useEffect, useState, useMemo } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegisterPlayer,
  usePreviousGameCode,
  useGetGameByCode,
} from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

const HeroSection: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");

  const { write: registerPlayer, isPending: registerPending } = useRegisterPlayer();

  const { data: isUserRegistered, isLoading: isRegisteredLoading } = useIsRegistered(address);
  const { data: fetchedUsername } = useGetUsername(address);
  const { data: gameCode } = usePreviousGameCode(address);
  const { data: contractGame } = useGetGameByCode(gameCode);

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
        const res = await apiClient.get<ApiResponse>(`/users/by-address/${address}?chain=Base`);
        if (!isActive) return;
        if (res.success && res.data) setUser(res.data as UserType);
        else setUser(null);
      } catch (error: any) {
        if (!isActive) return;
        if (error?.response?.status === 404) setUser(null);
        else console.error("Error fetching user:", error);
      }
    };

    fetchUser();
    return () => { isActive = false; };
  }, [address]);

  const registrationStatus = useMemo(() => {
    if (!address) return "disconnected";
    const hasBackend = !!user;
    const hasOnChain = !!isUserRegistered || localRegistered;

    if (hasBackend && hasOnChain) return "fully-registered";
    if (hasBackend && !hasOnChain) return "backend-only";
    return "none";
  }, [address, user, isUserRegistered, localRegistered]);

  const displayUsername = useMemo(() => {
    return user?.username || localUsername || fetchedUsername || inputUsername || "Player";
  }, [user, localUsername, fetchedUsername, inputUsername]);

  const handleRegister = async () => {
    if (!address) return toast.error("Please connect your wallet");

    let finalUsername = inputUsername.trim();
    if (registrationStatus === "backend-only" && user?.username) {
      finalUsername = user.username.trim();
    }

    if (!finalUsername) return toast.warn("Please enter a username");

    setLoading(true);
    const toastId = toast.loading("Processing registration...");

    try {
      if (!isUserRegistered && !localRegistered) {
        await registerPlayer(finalUsername);
      }

      if (!user) {
        const res = await apiClient.post<ApiResponse>("/users", {
          username: finalUsername,
          address,
          chain: "Base",
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
      let message = "Registration failed. Try again.";
      if (err?.code === 4001 || err?.message?.includes("User rejected")) {
        message = "Transaction cancelled";
      } else if (err?.message?.includes("insufficient funds")) {
        message = "Insufficient gas funds";
      } else if (err?.shortMessage) {
        message = err.shortMessage;
      }

      toast.update(toastId, { render: message, type: err?.code === 4001 ? "info" : "error", isLoading: false, autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleContinuePrevious = () => {
    if (!gameCode) return;
    if (contractGame?.ai) {
      router.push(`/ai-play?gameCode=${gameCode}`);
    } else {
      router.push(`/game-play?gameCode=${gameCode}`);
    }
  };

  if (isConnecting) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#010F10]">
        <p className="font-orbitron text-[#00F0FF] text-lg">Connecting to wallet...</p>
      </div>
    );
  }

  return (
    <section className="relative w-full min-h-screen bg-[#010F10] overflow-hidden">
      {/* Background Image */}
      <Image
        src={herobg}
        alt="Hero Background"
        fill
        className="object-cover hero-bg-zoom"
        priority
        quality={80}
      />

      {/* Big TYCOON Title (Top) */}
      <div className="absolute top-0 left-0 w-full flex items-center justify-center pt-16 sm:pt-20">
        <h1 className="uppercase font-kronaOne text-transparent text-[48px] sm:text-[60px] md:text-[80px] lg:text-[135px] leading-none bg-clip-text bg-gradient-to-b from-[#00F0FF]/50 to-transparent">
          TYCOON
        </h1>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 pb-10 pt-32 sm:pt-40">
        {/* Welcome / Loading */}
        {(registrationStatus === "fully-registered" || registrationStatus === "backend-only") && !loading && (
          <p className="font-orbitron text-[#00F0FF] text-xl sm:text-2xl font-bold text-center mb-4">
            Welcome back, {displayUsername}!
          </p>
        )}
        {loading && (
          <p className="font-orbitron text-[#00F0FF] text-xl sm:text-2xl font-bold text-center mb-4">
            Registering... Please wait.
          </p>
        )}

        {/* Tagline Animation */}
        <TypeAnimation
          sequence={[
            "Conquer", 1200,
            "Conquer • Build", 1200,
            "Conquer • Build • Trade On", 1800,
            "Play Solo vs AI", 2000,
            "Conquer • Build", 1000,
            "Conquer", 1000,
            "", 500,
          ]}
          wrapper="p"
          speed={40}
          repeat={Infinity}
          className="font-orbitron text-[#F0F7F7] text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-2"
        />

        {/* Main TYCOON + ? */}
        <h1 className="font-orbitron font-black text-[#17ffff] text-6xl sm:text-7xl md:text-8xl lg:text-[116px] leading-tight tracking-tight">
          TYCOON
          <span className="absolute -top-2 sm:top-0 left-[68%] text-[#0FF0FC] text-4xl sm:text-5xl font-dmSans font-bold rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        {/* Description Animation */}
        <div className="max-w-lg text-center mt-6">
          <TypeAnimation
            sequence={[
              "Roll the dice", 2000,
              "Buy properties", 2000,
              "Collect rent", 2000,
              "Play against AI opponents", 2200,
              "Become the top tycoon", 2000,
            ]}
            wrapper="p"
            speed={50}
            repeat={Infinity}
            className="font-orbitron text-[#F0F7F7] text-lg sm:text-xl md:text-2xl font-bold"
          />
          <p className="font-dmSans text-[#F0F7F7]/90 text-sm sm:text-base mt-4 leading-relaxed px-2">
            Step into Tycoon — the Web3 twist on the classic game of strategy, ownership, and fortune. Play solo against AI, compete in multiplayer rooms, collect tokens, complete quests, and become the ultimate blockchain tycoon.
          </p>
        </div>

        {/* Action Area */}
        <div className="w-full max-w-md flex flex-col items-center mt-10 gap-5">
          {/* Username Input - Only for new users */}
          {address && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-full max-w-xs h-12 bg-[#0E1415]/80 rounded-xl border border-[#003B3E] px-4 text-[#17ffff] text-center placeholder:text-[#455A64] focus:outline-none focus:border-[#00F0FF] text-base"
            />
          )}

          {/* Register Button */}
          {address && registrationStatus !== "fully-registered" && !loading && (
            <button
              onClick={handleRegister}
              disabled={loading || registerPending || (registrationStatus === "none" && !inputUsername.trim())}
              className="w-full max-w-xs h-14 relative overflow-hidden rounded-xl disabled:opacity-60"
            >
              <svg width="100%" height="100%" viewBox="0 0 280 56" fill="none" className="absolute inset-0">
                <path
                  d="M12 1H268C273.373 1 276 7.85486 273.601 12.5127L250.167 54.5127C249.151 56.0646 247.42 57 245.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z"
                  fill="#00F0FF"
                  stroke="#0E282A"
                  strokeWidth={2}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-lg font-orbitron font-bold">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
          )}

          {/* Buttons for Registered Users */}
          {address && registrationStatus === "fully-registered" && (
            <div className="flex flex-col w-full gap-4">
              {/* Continue Game - Primary */}
              {gameCode && contractGame?.status == 1 && (
                <button
                  onClick={handleContinuePrevious}
                  className="w-full h-14 relative overflow-hidden rounded-xl"
                >
                  <svg width="100%" height="100%" viewBox="0 0 320 56" fill="none" className="absolute inset-0 animate-pulse">
                    <path d="M12 1H308C313.373 1 316 7.85486 313.601 12.5127L290.167 54.5127C289.151 56.0646 287.42 57 285.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z" fill="#00F0FF" stroke="#0E282A" strokeWidth={2} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-xl font-orbitron font-bold">
                    <Gamepad2 className="mr-2 w-8 h-8" /> Continue Game
                  </span>
                </button>
              )}

              {/* Challenge AI - Primary */}
              <button
                onClick={() => router.push("/play-ai")}
                className="w-full h-14 relative overflow-hidden rounded-xl"
              >
                <svg width="100%" height="100%" viewBox="0 0 280 56" fill="none" className="absolute inset-0">
                  <path d="M12 1H268C273.373 1 276 7.85486 273.601 12.5127L250.167 54.5127C249.151 56.0646 247.42 57 245.565 57H12C8.96244 57 6.5 54.5376 6.5 51.5V9.5C6.5 6.46243 8.96243 4 12 4Z" fill="#00F0FF" stroke="#0E282A" strokeWidth={2} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-lg font-orbitron font-bold uppercase">
                  Challenge AI!
                </span>
              </button>

              {/* Secondary Actions Row */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => router.push("/game-settings")}
                  className="flex-1 h-12 bg-[#003B3E]/50 border border-[#003B3E] rounded-lg flex items-center justify-center text-[#00F0FF] text-sm font-dmSans font-medium hover:border-[#00F0FF] transition"
                >
                  <Gamepad2 className="mr-2 w-5 h-5" /> Multiplayer
                </button>
                <button
                  onClick={() => router.push("/join-room")}
                  className="flex-1 h-12 bg-[#0E1415]/80 border border-[#003B3E] rounded-lg flex items-center justify-center text-[#0FF0FC] text-sm font-dmSans font-medium hover:border-[#00F0FF] transition"
                >
                  <Dices className="mr-2 w-5 h-5" /> Join Room
                </button>
              </div>
            </div>
          )}

          {!address && (
            <p className="text-gray-400 text-center mt-6 text-sm">
              Please connect your wallet to continue.
            </p>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;