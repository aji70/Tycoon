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
  useRegister,
  usePreviousGame,
} from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

const HeroSectionMobile: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();

  const [loading, setLoading] = useState(false);
  const [inputUsername, setInputUsername] = useState("");

  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");

  const { write: registerPlayer, isPending: registerPending } = useRegister();

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
  } = useIsRegistered(address, { enabled: !!address });

  const { data: fetchedUsername } = useGetUsername(address, {
    enabled: !!address,
  });

  const { data: gameCode } = usePreviousGame(address, {
    enabled: !!address,
  });

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
    if (!address) return "disconnected";

    const hasBackend = !!user;
    const hasOnChain = !!isUserRegistered || localRegistered;

    if (hasBackend && hasOnChain) return "fully-registered";
    if (hasBackend && !hasOnChain) return "backend-only";
    return "none";
  }, [address, user, isUserRegistered, localRegistered]);

  const displayUsername = useMemo(() => {
    return (
      user?.username ||
      localUsername ||
      fetchedUsername ||
      inputUsername ||
      "Player"
    );
  }, [user, localUsername, fetchedUsername, inputUsername]);

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
      if (err?.code === 4001 || err?.message?.includes("User rejected")) {
        toast.update(toastId, {
          render: "Transaction cancelled",
          type: "info",
          isLoading: false,
          autoClose: 3500,
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

  const handleContinuePrevious = () => {
    if (gameCode) {
      router.push(`/ai-play?gameCode=${gameCode}`);
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
    <section className="relative w-full min-h-screen bg-[#010F10] overflow-x-hidden pb-12">
      {/* Background Image */}
      <div className="absolute inset-0">
        <Image
          src={herobg}
          alt="Hero Background"
          fill
          className="object-cover hero-bg-zoom"
          priority
          quality={90}
        />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-16 pb-10 min-h-screen">
        {/* Title */}
        <h1 className="font-orbitron font-black text-6xl sm:text-7xl leading-none uppercase text-[#17ffff] tracking-[-0.02em] text-center mt-10">
          TYCOON
          <span className="absolute -top-1 -right-6 text-[#0FF0FC] font-dmSans font-bold text-3xl rotate-12 animate-pulse">
            ?
          </span>
        </h1>

        {/* Welcome / Loading message */}
        <div className="mt-6 text-center">
          {(registrationStatus === "fully-registered" || registrationStatus === "backend-only") &&
            !loading && (
              <p className="font-orbitron text-xl font-bold text-[#00F0FF]">
                Welcome back, {displayUsername}!
              </p>
            )}

          {loading && (
            <p className="font-orbitron text-xl font-bold text-[#00F0FF]">
              Registering... Please wait
            </p>
          )}
        </div>

        {/* Animated phrase */}
        <div className="mt-5">
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
            className="font-orbitron text-2xl sm:text-3xl font-bold text-[#F0F7F7] text-center block"
          />
        </div>

        {/* Short description */}
        <p className="mt-6 text-center text-[#DDEEEE] text-base leading-relaxed max-w-[340px] font-dmSans">
          Roll the dice • Buy properties • Collect rent •
          Play against AI • Become the top tycoon
        </p>

        {/* Main action area */}
        <div className="mt-10 w-full max-w-[380px] flex flex-col items-center gap-6">
          {/* Username input - only for new users */}
          {address && registrationStatus === "none" && !loading && (
            <input
              type="text"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
              placeholder="Choose your tycoon name"
              className="w-full h-12 bg-[#0E1415]/80 backdrop-blur-sm rounded-xl border border-[#004B4F] outline-none px-5 text-[#17ffff] font-orbitron text-base text-center placeholder:text-[#6B8A8F] placeholder:font-dmSans"
            />
          )}

          {/* Register button */}
          {address && registrationStatus !== "fully-registered" && !loading && (
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
              <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-lg font-orbitron font-bold z-10">
                {loading || registerPending ? "Registering..." : "Let's Go!"}
              </span>
            </button>
          )}

          {/* Registered user actions */}
          {address && registrationStatus === "fully-registered" && (
            <div className="w-full flex flex-col gap-5">
              {/* Continue Previous Game - prominent when available */}
              {gameCode && (
                <button
                  onClick={handleContinuePrevious}
                  className="relative w-full h-14 transition-transform active:scale-[0.98]"
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
                  <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-base font-orbitron font-bold gap-2">
                    <Gamepad2 size={20} />
                    Continue Game
                  </span>
                </button>
              )}

              {/* Secondary buttons grid */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => router.push("/game-settings")}
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
                    Friends
                  </span>
                </button>

                <button
                  onClick={() => router.push("/join-room")}
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

              {/* Challenge AI - always visible and prominent */}
              <button
                onClick={() => router.push("/play-ai")}
                className="relative w-full h-14 transition-transform active:scale-[0.98]"
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
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-lg font-orbitron font-bold uppercase">
                  Challenge AI!
                </span>
              </button>
            </div>
          )}

          {!address && !loading && (
            <p className="text-gray-400 text-sm text-center mt-6">
              Connect your wallet to start playing
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSectionMobile;