"use client";
import React, { useEffect, useState } from "react";
import herobg from "@/public/heroBg.png";
import Image from "next/image";
import { Dices, BarChart2, Gamepad2 } from "lucide-react";
import { TypeAnimation } from "react-type-animation";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import {
  useIsRegistered,
  useGetUsername,
  useRegister
} from "@/context/ContractProvider";
import { toast } from "react-toastify";
import { apiClient } from "@/lib/api";
import { User as UserType } from "@/lib/types/users";
import { ApiResponse } from "@/types/api";

const HeroSectionMobile: React.FC = () => {
  const router = useRouter();
  const { address, isConnecting } = useAccount();
  
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
// Remove the username argument
const {
  write: registerPlayer,
  isPending,
} = useRegister(); // ← no args

  const {
    data: isUserRegistered,
    isLoading: isRegisteredLoading,
    error: registeredError,
  } = useIsRegistered(address, { enabled: !!address });
  const { data: fetchedUsername } = useGetUsername(address, {
    enabled: !!address,
  });

  // New: Local state for optimistic updates after registration
  const [localRegistered, setLocalRegistered] = useState(false);
  const [localUsername, setLocalUsername] = useState("");

  

  useEffect(() => {
  if (registeredError) {
    console.error("Registration check error:", registeredError);

    const msg = registeredError?.message?.toLowerCase() || "";

    // Suppress annoying viem errors that happen on wallet connect / wrong chain
    if (
      msg.includes("contract not found") ||
      msg.includes("invalid address") ||
      msg.includes("could not detect network") ||
      msg.includes("connector not connected") ||
      msg.includes("network changed") ||
      msg.includes("the contract function") // common viem error prefix
    ) {
      // Silently ignore — very common and not a real problem for the user
      console.log("errr message", msg)
      // return;
    }

    // Only show a gentle toast for actual issues
    toast.warn("Having trouble checking your status. Please switch to Celo or Base.", {
  autoClose: 70000,
});
  }

  // Always update the username state (optimistic + real data)
  if (isUserRegistered || localRegistered) {
    setUsername(fetchedUsername || localUsername || "Unknown");
  } else {
    setUsername("");
  }
}, [isUserRegistered, fetchedUsername, registeredError, localRegistered, localUsername]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const handleRouteToPrivateRoom = () => router.push("/game-settings");
  const handleRouteToJoinRoom = () => router.push("/join-room");
  const handleRouteToCreateGame = () => router.push("/game-settings");
  const handleRouteToPlayWithAI = () => router.push("/play-ai"); // New AI route

const handleRequest = async () => {
  if (!address) {
    toast.error("Please connect your wallet", { autoClose: 4000 });
    return;
  }
  if (!username.trim()) {
    toast.warn("Please enter a username", { autoClose: 3000 });
    return;
  }

  setLoading(true);
  const toastId = toast.loading("Waiting for wallet approval...", {
    position: "top-right",
  });

  try {
    await registerPlayer(username.trim());

    const res = await apiClient.post<ApiResponse>("/users", {
      username,
      address,
      chain: "Base",
    });

    if (res?.success) {
      setLocalRegistered(true);
      setLocalUsername(username);

      toast.update(toastId, {
        render: "Registered successfully! Welcome to Tycoon",
        type: "success",
        isLoading: false,
        autoClose: 4000,
        closeButton: true,
      });

      router.refresh();
    } else {
      throw new Error("Backend registration failed");
    }
  } catch (err: any) {
    // USER REJECTED – most common case
    if (
      err?.code === 4001 || 
      err?.message?.includes("User rejected") ||
      err?.message?.includes("User denied")
    ) {
      toast.update(toastId, {
        render: "You cancelled the transaction – no worries!",
        type: "info",
        isLoading: false,
        autoClose: 3500,
      });
      return;
    }

    // SIGNATURE REJECTED (e.g. permit2, signTypedData)
    if (err?.code === "ACTION_REJECTED") {
      toast.update(toastId, {
        render: "Signature declined",
        type: "info",
        isLoading: false,
        autoClose: 3000,
      });
      return;
    }

    // REAL ERRORS – show friendly message + optional details
    let message = "Something went wrong. Please try again.";

    if (err?.message?.includes("insufficient funds")) {
      message = "Not enough funds for gas";
    } else if (err?.reason) {
      message = err.reason;
    } else if (err?.shortMessage) {
      message = err.shortMessage;
    }

    toast.update(toastId, {
      render: (
        <div>
          <div>{message}</div>
          {/* Optional: uncomment if you want a tiny "details" toggle for devs */}
          <details className="text-xs mt-2 opacity-70">
            <summary className="cursor-pointer">Show details</summary>
            <pre className="mt-1 text-left overflow-x-auto">{err?.message}</pre>
          </details>
        </div>
      ),
      type: "error",
      isLoading: false,
      autoClose: 6000,
      closeOnClick: true,
    });
  } finally {
    setLoading(false);
  }
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
    <section className="z-0 w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10 bg-[#010F10] mt-[100px]">
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
        {/* New: Use localRegistered as fallback */}
        {(isUserRegistered || localRegistered) && !loading && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {username}!
            </p>
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
            Step into Tycoon — the Web3 twist on the classic game of
            strategy, ownership, and fortune. Play solo against AI, compete in
            multiplayer rooms, collect tokens, complete quests, and become the
            ultimate blockchain tycoon.
          </p>
        </div>

        <div className="z-1 w-full flex flex-col justify-center items-center mt-3 gap-3">
          {/* Registration Form */}
          {address && !(isUserRegistered || localRegistered) && !loading && (
            <>
              <input
                type="text"
                name="name"
                id="name"
                value={username}
                onChange={handleInputChange}
                required
                placeholder="input your name"
                className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans placeholder:text-[16px]"
              />
              <button
                type="button"
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                disabled={loading || !username.trim() || !address}
                onClick={handleRequest}
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
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                      Registering...
                    </span>
                  ) : (
                    "Let's Go!"
                  )}
                </span>
              </button>
            </>
          )}

          {!address && (
            <p className="text-gray-400 text-sm text-center mt-2">
              Please connect your wallet to continue.
            </p>
          )}

          {/* Action Buttons for Registered Users */}
          {address && (isUserRegistered || localRegistered) && (
            <div className="flex flex-wrap justify-center items-center mt-2 gap-4">
              {/* Create Game */}
              <button
                type="button"
                onClick={handleRouteToCreateGame}
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
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Gamepad2 className="mr-1.5 w-[16px] h-[16px]" />
                  Play with Friends
                </span>
              </button>

              {/* Join Room */}
              <button
                type="button"
                onClick={handleRouteToJoinRoom}
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
                    className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-2">
                  <Dices className="mr-1.5 w-[16px] h-[16px]" />
                  Join Room
                </span>
              </button>

              {/* PLAY WITH AI - Updated to be more attractive/shouty */}
              <button
                type="button"
                onClick={handleRouteToPlayWithAI}
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
                    className="group-hover:fill-[#00F0FF]/80 transition-all duration-300 ease-in-out"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[#010F10] uppercase text-[16px] -tracking-[2%] font-orbitron font-[700] z-2">
                  <svg
                    className="mr-2 w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="9" cy="15" r="1.5" />
                    <circle cx="15" cy="15" r="1.5" />
                    <path d="M9 11v-1a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1" />
                    <path d="M12 17v4" />
                  </svg>
                  Challenge AI!
                </span>
              </button>
            </div>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSectionMobile;