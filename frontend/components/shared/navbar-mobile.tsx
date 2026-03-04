'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { House, Volume2, VolumeOff, Globe, Menu, X, User, ShoppingBag, Trophy, Swords, BookOpen } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';
import { useGetUsername } from '@/context/ContractProvider';
import { useProfileAvatar } from '@/context/ProfileContext';
import { isAddress } from 'viem';
import { usePrivy } from '@privy-io/react-auth';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';

const SCROLL_TOP_THRESHOLD = 40;
const SCROLL_SENSITIVITY = 8;

interface NavBarMobileProps {
  /** When true (e.g. on board-3d-mobile), show only a hamburger — no full navbar bar so it doesn't cover the board */
  minimal?: boolean;
}

const NavBarMobile = ({ minimal = false }: NavBarMobileProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { scrollY, scrollYProgress } = useScroll();

  const isGamePage = pathname?.includes('/board') || pathname?.includes('game-play') || pathname?.includes('ai-play');
  const shopHref = isGamePage && pathname
    ? `/game-shop?returnTo=${encodeURIComponent(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''))}`
    : '/game-shop';
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [navVisible, setNavVisible] = useState(false);
  const lastScrollY = useRef(0);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (minimal) return;
    const y = typeof window !== 'undefined' ? window.scrollY ?? 0 : 0;
    lastScrollY.current = y;
    setNavVisible(y < SCROLL_TOP_THRESHOLD);
    hasScrolled.current = y > 0;
  }, [minimal]);

  useEffect(() => {
    if (minimal) return;
    const unsubscribe = scrollY.on('change', (latest) => {
      const diff = latest - lastScrollY.current;
      if (latest < SCROLL_TOP_THRESHOLD) {
        setNavVisible(true);
        hasScrolled.current = true;
      } else if (hasScrolled.current) {
        if (diff < -SCROLL_SENSITIVITY) setNavVisible(true);
        else if (diff > SCROLL_SENSITIVITY) setNavVisible(false);
      }
      lastScrollY.current = latest;
    });
    return () => unsubscribe();
  }, [scrollY, minimal]);

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const { connect } = useConnect();
  const { ready, authenticated, login, logout, user } = usePrivy();
  const guestAuth = useGuestAuthOptional();
  const guestUser = guestAuth?.guestUser ?? null;
  const isPrivyAuthed = ready && authenticated;

  const networkDisplay = caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : '—');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);

  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

const safeAddress = address && isAddress(address) 
  ? address as `0x${string}` 
  : undefined;

const { data: fetchedUsername } = useGetUsername(safeAddress);
  const profileAvatar = useProfileAvatar();

  // MiniPay detection + auto-connect attempt
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      if (!isConnected) {
        connect({ connector: injected() });
      }
    }
  }, [connect, isConnected]);

  const toggleSound = () => {
    if (isSoundPlaying) {
      pause();
      setIsSoundPlaying(false);
    } else {
      play();
      setIsSoundPlaying(true);
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const hamburgerButton = (
    <button
      onClick={() => setIsMobileMenuOpen(true)}
      className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-5 z-[999] w-12 h-12 rounded-xl bg-gradient-to-b from-[#022a2c] to-[#011112] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_24px_rgba(0,240,255,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#00F0FF]/50 active:scale-[0.98] transition-all duration-200"
      aria-label="Open menu"
    >
      <Menu size={22} strokeWidth={2.5} />
    </button>
  );

  return (
    <>
      {/* Minimal mode (e.g. board-3d-mobile): only hamburger — no navbar bar covering the board */}
      {minimal ? (
        hamburgerButton
      ) : (
        <>
          {/* Mobile Fixed Header - game HUD style, slides up when scrolling down */}
          <motion.header
            initial={false}
            animate={{ y: navVisible ? 0 : -100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 right-0 h-[82px] pt-safe flex flex-col z-[1000]"
          >
            {/* Game-style "energy" progress bar */}
            <motion.div
              className="h-1 origin-left shrink-0 rounded-r-full bg-gradient-to-r from-[#00F0FF] to-[#0FF0FC] shadow-[0_0_12px_rgba(0,240,255,0.6)]"
              style={{ scaleX }}
            />
            <div className="flex-1 flex items-center justify-between px-4 bg-gradient-to-b from-[#021a1b]/95 to-[#010F10]/98 backdrop-blur-xl border-b-2 border-[#00F0FF]/20 shadow-[0_4px_20px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(0,240,255,0.08)]">
              <Logo className="w-[44px] drop-shadow-[0_0_8px_rgba(0,240,255,0.2)]" image={LogoIcon} href="/" />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSound}
                  aria-label={isSoundPlaying ? "Sound on" : "Sound off"}
                  className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#03383a] to-[#011112] border border-[#00F0FF]/25 flex items-center justify-center text-white/90 shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[#00F0FF]/40 hover:shadow-[0_0_16px_rgba(0,240,255,0.12)] hover:text-white active:scale-[0.97] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10]"
                >
                  {isSoundPlaying ? <Volume2 size={20} /> : <VolumeOff size={20} />}
                </button>

                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#03383a] to-[#011112] border border-[#00F0FF]/35 flex items-center justify-center text-[#00F0FF] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#00F0FF]/55 hover:shadow-[0_0_18px_rgba(0,240,255,0.2)] active:scale-[0.97] transition-all duration-200"
                >
                  <Menu size={21} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </motion.header>

          {/* Floating Menu Button - visible when navbar is hidden */}
          <motion.button
            initial={false}
            animate={{
              opacity: navVisible ? 0 : 1,
              pointerEvents: navVisible ? 'none' : 'auto',
              scale: navVisible ? 0.9 : 1,
            }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileMenuOpen(true)}
            className="fixed top-[calc(env(safe-area-inset-top)+0.5rem)] right-5 z-[999] w-12 h-12 rounded-xl bg-gradient-to-b from-[#022a2c] to-[#011112] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_24px_rgba(0,240,255,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:border-[#00F0FF]/50 active:scale-[0.98] transition-all duration-200"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={2.5} />
          </motion.button>
        </>
      )}

      {/* Mobile Bottom Sheet Menu - game pause/menu panel style */}
      {isMobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/75 backdrop-blur-[2px] z-[55]" onClick={closeMobileMenu} />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 pb-safe bg-gradient-to-b from-[#021a1c] to-[#010F10] backdrop-blur-2xl rounded-t-[1.75rem] border-t-2 border-[#00F0FF]/25 shadow-[0_-8px_40px_rgba(0,0,0,0.5)] z-[60] max-h-[90dvh] overflow-y-auto overscroll-contain"
          >
            <div className="p-5 pb-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] relative">
              {/* Drag Handle - game UI divider */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#00F0FF]/70 to-transparent shadow-[0_0_10px_rgba(0,240,255,0.3)]" />
              </div>

              {/* Wallet Section - HUD card (wallet or Privy signed in) */}
              <div className="mb-6 space-y-4">
                {(isConnected || isPrivyAuthed || guestUser) && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-[#022a2c]/90 to-[#011112] border border-[#00F0FF]/20 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(0,240,255,0.06)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg border-2 border-[#00F0FF]/40 overflow-hidden shadow-[0_0_12px_rgba(0,240,255,0.15)] shrink-0 ring-1 ring-[#00F0FF]/10">
                        {profileAvatar ? (
                          <img src={profileAvatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          <Image src={avatar} alt="Avatar" width={44} height={44} className="object-cover w-full h-full" />
                        )}
                      </div>
                      <span className="text-[#00F0FF] font-orbitron font-semibold text-base tracking-wide">
                        {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : guestUser ? `Guest: ${guestUser.username}` : (typeof user?.email === 'string' ? user?.email : (user?.email as { address?: string })?.address) ?? 'Signed in'}
                      </span>
                    </div>
                  </div>
                )}

                {isMiniPay && !isConnected && (
                  <p className="text-center text-xs text-[#00F0FF]/60 font-medium">
                    Connecting via MiniPay...
                  </p>
                )}
              </div>

              {/* Menu label */}
              <p className="text-[#00F0FF]/50 font-orbitron text-xs uppercase tracking-[0.2em] mb-3 px-1">
                Menu
              </p>

              {/* Navigation Links - game menu options */}
              <nav className="space-y-2 mb-6">
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-white font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-[#00F0FF]/90">
                    <House size={20} />
                  </div>
                  Home
                </Link>

                <Link
                  href="/how-to-play"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#00F0FF] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-[#00F0FF]/90">
                    <BookOpen size={20} />
                  </div>
                  How to Play
                </Link>

                <Link
                  href="/leaderboard"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#00F0FF] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-amber-400/90">
                    <Trophy size={20} />
                  </div>
                  Leaderboard
                </Link>

                <Link
                  href="/tournaments"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#00F0FF] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-[#00F0FF]/90">
                    <Swords size={20} />
                  </div>
                  Tournaments
                </Link>

                {(isConnected || isPrivyAuthed || guestUser) && (
                  <>
                    <Link
                      href="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#00F0FF] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-[#00F0FF]/90">
                        <User size={20} />
                      </div>
                      {fetchedUsername || 'Profile'}
                    </Link>

                    <Link
                      href={shopHref}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#0FF0FC] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)]"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-emerald-400/90">
                        <ShoppingBag size={20} />
                      </div>
                      Shop
                    </Link>
                  </>
                )}
              </nav>

              {/* Network - same row style as other nav items */}
              {!isMiniPay && (
                <>
                  <button
                    onClick={() => {
                      setIsNetworkModalOpen(true);
                      closeMobileMenu();
                    }}
                    className="flex items-center gap-4 py-4 px-5 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#00F0FF] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] w-full text-left"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#003B3E]/50 flex items-center justify-center text-[#00F0FF]/90 shrink-0">
                      <Globe size={20} />
                    </div>
                    <span className="truncate">{networkDisplay}</span>
                  </button>

                  <div className="mt-4">
                    {isConnected ? (
                      <button
                        onClick={() => {
                          setIsDisconnectModalOpen(true);
                          closeMobileMenu();
                        }}
                        className="w-full py-4 rounded-xl bg-red-950/50 hover:bg-red-900/40 border border-red-500/40 text-red-400 font-orbitron font-medium transition-all duration-200"
                      >
                        Disconnect Wallet
                      </button>
                    ) : guestUser ? (
                      <button
                        onClick={() => {
                          guestAuth?.logoutGuest();
                          closeMobileMenu();
                        }}
                        className="w-full py-4 rounded-xl bg-[#011112]/80 hover:bg-[#022a2c]/80 border border-[#003B3E]/60 text-[#00F0FF] font-orbitron font-medium transition-all duration-200"
                      >
                        Guest: {guestUser.username} · Sign out
                      </button>
                    ) : isPrivyAuthed ? (
                      <button
                        onClick={() => {
                          logout();
                          closeMobileMenu();
                        }}
                        className="w-full py-4 rounded-xl bg-[#011112]/80 hover:bg-[#022a2c]/80 border border-[#003B3E]/60 text-[#00F0FF] font-orbitron font-medium transition-all duration-200"
                      >
                        {typeof user?.email === 'string' ? user.email : (user?.email as { address?: string })?.address ?? 'Signed in'} · Log out
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          login();
                          closeMobileMenu();
                        }}
                        className="w-full py-4 rounded-xl bg-gradient-to-r from-[#00F0FF]/25 to-[#0FF0FC]/20 border border-[#00F0FF]/50 text-[#00F0FF] font-orbitron font-bold text-lg tracking-wide hover:from-[#00F0FF]/35 hover:to-[#0FF0FC]/28 hover:shadow-[0_0_24px_rgba(0,240,255,0.2)] hover:border-[#00F0FF]/60 active:scale-[0.99] transition-all duration-200"
                      >
                        Sign in
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Close - game UI button */}
              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-xl bg-[#011112]/90 border border-[#003B3E]/60 flex items-center justify-center text-white/90 hover:bg-[#022a2c] hover:border-[#00F0FF]/25 hover:text-[#00F0FF] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#010F10]"
              >
                <X size={22} />
              </button>
            </div>
          </motion.div>
        </>
      )}

      {/* Modals */}
      <NetworkSwitcherModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />
      <WalletConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
      />
      <WalletDisconnectModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
      />
    </>
  );
};

export default NavBarMobile;