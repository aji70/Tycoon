'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { House, Volume2, VolumeOff, User, ShoppingBag, Trophy, Globe, Swords, MessageCircle, Wallet, BookOpen, Bot, MoreVertical } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { PiUserCircle } from 'react-icons/pi';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';
import { useProfileAvatar } from '@/context/ProfileContext';
import { useOnlineUsers } from '@/hooks/useOnlineUsers';
import { usePrivy } from '@privy-io/react-auth';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';

const PREFETCH_ROUTES = ['/game-shop', '/arena', '/profile', '/leaderboard'] as const;

const NavBar = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { scrollYProgress } = useScroll();

  const isGamePage = pathname?.includes('/board') || pathname?.includes('game-play') || pathname?.includes('ai-play');
  const shopHref = isGamePage && pathname
    ? `/game-shop?returnTo=${encodeURIComponent(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''))}`
    : '/game-shop';
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const { onlineCount, onlineUsers } = useOnlineUsers(isConnected ? address : undefined);
  const [onlineDropdownOpen, setOnlineDropdownOpen] = useState(false);
  const onlineDropdownRef = useRef<HTMLDivElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (onlineDropdownRef.current && !onlineDropdownRef.current.contains(e.target as Node)) {
        setOnlineDropdownOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
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
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isPrivyAuthed = ready && authenticated;
  const isSignedIn = isConnected || isPrivyAuthed || !!guestUser;

  const toggleSound = () => {
    if (isSoundPlaying) {
      pause();
      setIsSoundPlaying(false);
    } else {
      play();
      setIsSoundPlaying(true);
    }
  };

  // Prefetch main nav routes when idle so navigation feels instant
  useEffect(() => {
    const t = window.setTimeout(() => {
      PREFETCH_ROUTES.forEach((r) => router.prefetch(r));
    }, 2000);
    return () => window.clearTimeout(t);
  }, [router]);

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
          {/* Online players (when wallet connected) */}
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

          {/* Agents → Agent Arena */}
          {isSignedIn && (
            <Link
              href="/arena"
              onMouseEnter={() => router.prefetch('/arena')}
              className="w-[90px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <Bot className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Agents</span>
            </Link>
          )}

          {/* Perk Shop button */}
          {isSignedIn && (
            <Link
              href={shopHref}
              onMouseEnter={() => router.prefetch('/game-shop')}
              className="min-w-[90px] h-[40px] px-3 border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#0FF0FC]"
            >
              <ShoppingBag className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Perk Shop</span>
            </Link>
          )}

          {/* Leaderboard button */}
          {isSignedIn && (
            <Link
              href="/leaderboard"
              onMouseEnter={() => router.prefetch('/leaderboard')}
              className="w-[100px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <Trophy className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Leaderboard</span>
            </Link>
          )}


          {/* Profile button */}
          {isSignedIn && (
            <Link
              href="/profile"
              onMouseEnter={() => router.prefetch('/profile')}
              className="w-[80px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]"
            >
              <User className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">Profile</span>
            </Link>
          )}


          {/* Home button */}
          <Link
            href="/"
            aria-label="Home"
            className="w-[40px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] hidden md:flex justify-center items-center bg-[#011112] text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#011112]"
          >
            <House className="w-[16px] h-[16px]" />
          </Link>

          {/* More Menu */}
          <div className="relative hidden md:block" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className="w-[40px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center bg-[#011112] text-[#00F0FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#011112]"
              aria-label="More options"
            >
              <MoreVertical className="w-[16px] h-[16px]" />
            </button>
            {moreMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[#0E282A] bg-[#011112] shadow-xl z-50 py-2">
                {/* Arena */}
                {isSignedIn && (
                  <Link
                    href="/arena"
                    className="px-4 py-2.5 flex items-center gap-2 text-[#00F0FF] hover:bg-[#0E282A] text-sm transition"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    <Swords className="w-[16px] h-[16px]" />
                    <span className="font-dmSans">⚔️ Agent Arena</span>
                  </Link>
                )}

                {/* Tournaments */}
                {isSignedIn && (
                  <Link
                    href="/tournaments"
                    className="px-4 py-2.5 flex items-center gap-2 text-[#00F0FF] hover:bg-[#0E282A] text-sm transition"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    <Trophy className="w-[16px] h-[16px]" />
                    <span className="font-dmSans">Tournaments</span>
                  </Link>
                )}

                {/* Rooms */}
                {isSignedIn && (
                  <Link
                    href="/rooms"
                    className="px-4 py-2.5 flex items-center gap-2 text-[#00F0FF] hover:bg-[#0E282A] text-sm transition"
                    onClick={() => setMoreMenuOpen(false)}
                  >
                    <MessageCircle className="w-[16px] h-[16px]" />
                    <span className="font-dmSans">Rooms</span>
                  </Link>
                )}

                {/* How to Play */}
                <Link
                  href="/how-to-play"
                  className="px-4 py-2.5 flex items-center gap-2 text-[#00F0FF] hover:bg-[#0E282A] text-sm transition"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  <BookOpen className="w-[16px] h-[16px]" />
                  <span className="font-dmSans">How to Play</span>
                </Link>

                {/* Sound Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    toggleSound();
                    setMoreMenuOpen(false);
                  }}
                  className="w-full px-4 py-2.5 flex items-center gap-2 text-[#00F0FF] hover:bg-[#0E282A] text-sm transition text-left"
                >
                  {isSoundPlaying ? (
                    <>
                      <Volume2 className="w-[16px] h-[16px]" />
                      <span className="font-dmSans">Sound Off</span>
                    </>
                  ) : (
                    <>
                      <VolumeOff className="w-[16px] h-[16px]" />
                      <span className="font-dmSans">Sound On</span>
                    </>
                  )}
                </button>

                {/* Online Players */}
                {isConnected && (
                  <div className="px-4 py-2.5 flex items-center gap-2 text-[#AFBAC0] text-sm border-t border-[#0E282A] mt-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-dmSans">{onlineCount} online</span>
                  </div>
                )}
              </div>
            )}
          </div>


          {/* Wallet, guest, or Privy: wallet when connected; guest when signed in from hero; Privy sign in / signed in in nav */}
          {isConnected ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsNetworkModalOpen(true)}
                className="px-4 py-3 rounded-[12px] bg-[#003B3E] hover:bg-[#005458] border border-[#00F0FF]/30 text-[#00F0FF] font-orbitron font-medium text-sm transition-all flex items-center gap-2 shadow-md"
              >
                <Globe className="w-4 h-4" />
                <span className="truncate max-w-[120px]">{networkDisplay}</span>
              </button>
              <div className="flex items-center gap-3 px-5 py-3 rounded-[12px] border border-[#0E282A] bg-[#011112] text-[#00F0FF] font-orbitron">
                <div className="h-8 w-8 rounded-full border-2 border-[#0FF0FC] overflow-hidden shadow-lg shrink-0">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <Image src={avatar} alt="Wallet" width={32} height={32} className="object-cover w-full h-full" />
                  )}
                </div>
                <span className="text-sm tracking-wider">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                </span>
              </div>
              <button
                onClick={() => setIsDisconnectModalOpen(true)}
                className="px-4 py-3 rounded-[12px] bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-600/40 font-medium text-sm transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : guestUser ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => open()}
                className="hidden md:flex px-4 py-2 rounded-[12px] border border-[#003B3E] bg-[#0E1415] text-[#00F0FF] font-orbitron text-sm font-medium hover:border-[#00F0FF]/50 transition-all items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect wallet
              </button>
              <span className="px-3 py-2 rounded-[12px] border border-[#0E282A] bg-[#011112] text-[#00F0FF] text-xs font-dmSans">
                Guest: {guestUser.username}
              </span>
              <button
                type="button"
                onClick={() => guestAuth?.logoutGuest()}
                className="px-4 py-2 rounded-[12px] border border-[#0E282A] hover:border-[#003B3E] bg-[#011112] text-[#869298] hover:text-[#00F0FF] text-xs font-dmSans"
              >
                Sign out
              </button>
            </div>
          ) : isPrivyAuthed ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => open()}
                className="hidden md:flex px-4 py-2 rounded-[12px] border border-[#003B3E] bg-[#0E1415] text-[#00F0FF] font-orbitron text-sm font-medium hover:border-[#00F0FF]/50 transition-all items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect wallet
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="px-4 py-2 rounded-[12px] border border-[#0E282A] hover:border-[#003B3E] bg-[#011112] text-[#00F0FF] text-xs font-dmSans"
              >
                {typeof user?.email === 'string' ? user.email : (user?.email as { address?: string })?.address ?? 'Signed in'} · Log out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => login()}
                className="px-4 py-2 rounded-[12px] bg-[#0FF0FC]/80 hover:bg-[#0FF0FC]/40 text-[#0D191B] font-medium transition"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => open()}
                className="hidden md:flex px-4 py-2 rounded-[12px] border border-[#003B3E] bg-[#0E1415] text-[#00F0FF] font-orbitron text-sm font-medium hover:border-[#00F0FF]/50 transition-all items-center gap-2"
              >
                <Wallet className="w-4 h-4" />
                Connect wallet
              </button>
            </div>
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