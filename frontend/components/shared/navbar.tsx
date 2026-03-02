'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, User, ShoppingBag, Trophy, Globe, Swords, MessageCircle } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { PiUserCircle } from 'react-icons/pi';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';
import { useProfileAvatar } from '@/context/ProfileContext';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { usePrivy } from '@privy-io/react-auth';

const NavBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const { onlineCount, onlineUsers } = useOnlineUsers(isConnected ? address : undefined);
  const [onlineDropdownOpen, setOnlineDropdownOpen] = useState(false);
  const onlineDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdownOpen(false);
      }
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // Prioritize shortName if available (e.g., "Ethereum"), fall back to name, then chain ID
  const networkDisplay =  caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : 'Network');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const profileAvatar = useProfileAvatar();

  const { ready, authenticated, login, logout, user } = usePrivy();
  const isPrivyAuthed = ready && authenticated;

  const toggleSound = () => {
    if (isSoundPlaying) {
      pause();
      setIsSoundPlaying(false);
    } else {
      play();
      setIsSoundPlaying(true);
    }
  };

  return (
    <>
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 bg-[#0FF0FC] origin-[0%] h-[2px] z-[40]"
        style={{ scaleX }}
      />

      {/* Navbar */}
      <header className="w-full h-[87px] flex items-center justify-between px-4 md:px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm relative z-[50]">
        <Logo className="cursor-pointer md:w-[50px] w-[45px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-[4px]">
          {/* Online players (only when connected) */}
          {isConnected && (
            <div className="relative hidden md:block" ref={onlineDropdownRef}>
              <button
                type="button"
                onClick={() => setOnlineDropdownOpen((o) => !o)}
                className="w-[133px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center gap-2 bg-[#011112] text-[#AFBAC0]"
              >
                <PiUserCircle className="w-[16px] h-[16px]" />
                <span className="text-[12px] font-[400] font-dmSans">
                  {onlineCount} {onlineCount === 1 ? 'player' : 'players'} online
                </span>
              </button>
              {onlineDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl border border-[#0E282A] bg-[#011112] shadow-xl z-50 py-2">
                  <p className="px-3 py-1 text-[11px] text-[#869298] uppercase tracking-wide">Online now</p>
                  {onlineUsers.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-[#AFBAC0]">No one else online</p>
                  ) : (
                    onlineUsers.map((u, i) => (
                      <div key={u.userId ?? u.address ?? i} className="px-3 py-1.5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-[12px] text-[#F0F7F7] truncate">
                          {u.username || (u.address ? `${u.address.slice(0, 6)}...${u.address.slice(-4)}` : 'Anonymous')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Profile button (only when connected) */}
          {isConnected && (
            <Link
              href="/profile"
              className="w-[80px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <User className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Profile</span>
            </Link>
          )}

          {/* Shop button (only when connected) */}
          {isConnected && (
            <Link
              href="/game-shop"
              className="w-[70px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#0FF0FC]"
            >
              <ShoppingBag className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Shop</span>
            </Link>
          )}

          {/* Leaderboard button (only when connected) */}
          {isConnected && (
            <Link
              href="/leaderboard"
              className="w-[100px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <Trophy className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Leaderboard</span>
            </Link>
          )}

          {/* Tournaments button (only when connected) */}
          {isConnected && (
            <Link
              href="/tournaments"
              className="w-[95px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <Swords className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Tournaments</span>
            </Link>
          )}

          {/* Rooms button (only when connected) — general lobby with chat */}
          {isConnected && (
            <Link
              href="/rooms"
              className="w-[75px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <MessageCircle className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Rooms</span>
            </Link>
          )}

          {/* Home button */}
          <Link
            href="/"
            className="w-[40px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center bg-[#011112] text-white"
          >
            <House className="w-[16px] h-[16px]" />
          </Link>

          {/* Sound button */}
          <button
            type="button"
            onClick={toggleSound}
            className="w-[40px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center bg-[#011112] text-white"
          >
            {isSoundPlaying ? (
              <Volume2 className="w-[16px] h-[16px]" />
            ) : (
              <VolumeOff className="w-[16px] h-[16px]" />
            )}
          </button>

          {/* Privy auth entry point (replaces visible connect wallet button) */}
          {!isPrivyAuthed ? (
            <button
              type="button"
              onClick={() => login()}
              className="px-4 py-2 rounded-[12px] bg-[#0FF0FC]/80 hover:bg-[#0FF0FC]/40 text-[#0D191B] font-medium transition"
            >
              Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => logout()}
              className="px-4 py-2 rounded-[12px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] bg-[#011112] text-[#00F0FF] text-xs font-dmSans"
            >
              {typeof user?.email === 'string' ? user.email : (user?.email as { address?: string })?.address ?? 'Signed in'} · Log out
            </button>
          )}
        </div>
      </header>

      {/* Network Switcher Modal */}
      <NetworkSwitcherModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />

      {/* Wallet Connect Modal */}
      <WalletConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />

      {/* Wallet Disconnect Modal */}
      <WalletDisconnectModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
      />
    </>
  );
};

export default NavBar;