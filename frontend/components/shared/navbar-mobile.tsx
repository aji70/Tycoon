'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { House, Volume2, VolumeOff, Globe, Menu, X, ShoppingBag, Trophy, BookOpen, Bot, MessageCircle, FileText, Shield, LifeBuoy, ChevronRight } from 'lucide-react';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useConnect } from 'wagmi';
import { injected } from 'wagmi/connectors';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import ThemeSoundPlayer from './ThemeSoundPlayer';

const WalletConnectModal = dynamic(() => import('./wallet-connect-modal'), { ssr: false });
const WalletDisconnectModal = dynamic(() => import('./wallet-disconnect-modal'), { ssr: false });
import NetworkSwitcherModal from './network-switcher-modal';
import { useGetUsername } from '@/context/ContractProvider';
import { useProfileAvatar } from '@/context/ProfileContext';
import { isAddress } from 'viem';
import { usePrivy } from '@privy-io/react-auth';
import { useGuestAuthOptional } from '@/context/GuestAuthContext';
import { mergeProfilesFromGuestUser } from '@/lib/profile-storage';

const SCROLL_TOP_THRESHOLD = 40;
const SCROLL_SENSITIVITY = 8;

interface NavBarMobileProps {
  minimal?: boolean;
}

const PREFETCH_ROUTES = [
  '/game-shop',
  '/leaderboard',
  '/arena',
  '/rooms',
  '/tournaments',
  '/agent-tournaments',
] as const;

const NavBarMobile = ({ minimal = false }: NavBarMobileProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { scrollY, scrollYProgress } = useScroll();

  const isGamePage = pathname?.includes('/board') || pathname?.includes('game-play') || pathname?.includes('ai-play');
  const shopHref = isGamePage && pathname
    ? `/game-shop?returnTo=${encodeURIComponent(pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''))}`
    : '/game-shop';
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

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
  const hasGameSession = isConnected || !!guestUser;
  const signOutGuestAndPrivy = () => {
    guestAuth?.logoutGuest();
    if (isPrivyAuthed) void logout();
  };

  const networkDisplay = caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : '—');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [themeSoundMounted, setThemeSoundMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isMiniPay, setIsMiniPay] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      PREFETCH_ROUTES.forEach((r) => router.prefetch(r));
    }, 2000);
    return () => window.clearTimeout(t);
  }, [router]);

  const safeAddress = address && isAddress(address) ? address as `0x${string}` : undefined;
  const { data: fetchedUsername } = useGetUsername(safeAddress);
  const profileAvatar = useProfileAvatar();

  const [storedProfileTick, setStoredProfileTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setStoredProfileTick((t) => t + 1);
    window.addEventListener('tycoon-profile-updated', onUpdate);
    return () => window.removeEventListener('tycoon-profile-updated', onUpdate);
  }, []);

  const guestNavAvatar = useMemo(() => {
    if (!guestUser) return null;
    return mergeProfilesFromGuestUser(guestUser)?.avatar ?? null;
  }, [guestUser, pathname, storedProfileTick]);

  // Resolve display name: on-chain username > guest username > email > truncated address
  const displayName = useMemo(() => {
    if (fetchedUsername) return fetchedUsername;
    if (guestUser?.username) return guestUser.username;
    const email = typeof user?.email === 'string' ? user.email : (user?.email as { address?: string })?.address;
    if (email) return email.length > 20 ? email.slice(0, 18) + '…' : email;
    if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`;
    return 'Profile';
  }, [fetchedUsername, guestUser, user, address]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum?.isMiniPay) {
      setIsMiniPay(true);
      if (!isConnected) connect({ connector: injected() });
    }
  }, [connect, isConnected]);

  const toggleSound = () => {
    if (isSoundPlaying) {
      setIsSoundPlaying(false);
    } else {
      setThemeSoundMounted(true);
      setIsSoundPlaying(true);
    }
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const navItem = (href: string, icon: React.ReactNode, label: string, color = 'text-[#00F0FF]/90', onClick?: () => void) => (
    <Link
      href={href}
      onClick={() => { closeMobileMenu(); onClick?.(); }}
      onMouseEnter={() => router.prefetch(href)}
      className="flex items-center gap-4 py-3.5 px-4 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#E0F7F7] font-medium transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,240,255,0.08)] active:scale-[0.98]"
    >
      <div className={`w-9 h-9 rounded-lg bg-[#003B3E]/60 flex items-center justify-center ${color} shrink-0`}>
        {icon}
      </div>
      <span className="flex-1">{label}</span>
      <ChevronRight size={14} className="text-[#00F0FF]/30" />
    </Link>
  );

  const hamburgerButton = (
    <button
      onClick={() => setIsMobileMenuOpen(true)}
      className="fixed top-[calc(env(safe-area-inset-top)+0.5rem+60px)] right-5 z-[999] w-12 h-12 rounded-xl bg-gradient-to-b from-[#022a2c] to-[#011112] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15),inset_0_1px_0_rgba(255,255,255,0.06)] hover:shadow-[0_0_24px_rgba(0,240,255,0.25)] hover:border-[#00F0FF]/50 active:scale-[0.98] transition-all duration-200"
      aria-label="Open menu"
    >
      <Menu size={22} strokeWidth={2.5} />
    </button>
  );

  return (
    <>
      {themeSoundMounted ? <ThemeSoundPlayer playing={isSoundPlaying} /> : null}
      {minimal ? (
        hamburgerButton
      ) : (
        <>
          <motion.header
            initial={false}
            animate={{ y: navVisible ? 0 : -100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 right-0 h-[82px] pt-safe flex flex-col z-[1000]"
          >
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
                  aria-label={isSoundPlaying ? 'Sound on' : 'Sound off'}
                  className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#03383a] to-[#011112] border border-[#00F0FF]/25 flex items-center justify-center text-white/90 hover:border-[#00F0FF]/40 hover:shadow-[0_0_16px_rgba(0,240,255,0.12)] active:scale-[0.97] transition-all duration-200"
                >
                  {isSoundPlaying ? <Volume2 size={20} /> : <VolumeOff size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open main menu"
                  className="w-11 h-11 rounded-xl bg-gradient-to-b from-[#03383a] to-[#011112] border border-[#00F0FF]/35 flex items-center justify-center text-[#00F0FF] hover:border-[#00F0FF]/55 hover:shadow-[0_0_18px_rgba(0,240,255,0.2)] active:scale-[0.97] transition-all duration-200"
                >
                  <Menu size={21} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            </div>
          </motion.header>

          <motion.button
            initial={false}
            animate={{ opacity: navVisible ? 0 : 1, pointerEvents: navVisible ? 'none' : 'auto', scale: navVisible ? 0.9 : 1 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileMenuOpen(true)}
            className="fixed top-[calc(env(safe-area-inset-top)+0.5rem+60px)] right-5 z-[999] w-12 h-12 rounded-xl bg-gradient-to-b from-[#022a2c] to-[#011112] border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF] shadow-[0_0_20px_rgba(0,240,255,0.15)] hover:border-[#00F0FF]/50 active:scale-[0.98] transition-all duration-200"
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={2.5} />
          </motion.button>
        </>
      )}

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
            <div className="p-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] relative">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-4">
                <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-transparent via-[#00F0FF]/70 to-transparent shadow-[0_0_10px_rgba(0,240,255,0.3)]" />
              </div>

              {/* Profile card — clickable, shows avatar + username */}
              {(isConnected || guestUser || isPrivyAuthed) && (
                <Link
                  href="/profile"
                  onClick={closeMobileMenu}
                  className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-[#022a2c]/90 to-[#011112] border border-[#00F0FF]/25 shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(0,240,255,0.06)] flex items-center gap-3 hover:border-[#00F0FF]/45 hover:shadow-[0_0_24px_rgba(0,240,255,0.1)] active:scale-[0.99] transition-all duration-200 block"
                >
                  <div className="h-12 w-12 rounded-xl border-2 border-[#00F0FF]/40 overflow-hidden shadow-[0_0_12px_rgba(0,240,255,0.15)] shrink-0">
                    {guestNavAvatar || profileAvatar ? (
                      <img src={(guestNavAvatar || profileAvatar) as string} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <Image src={avatar} alt="Avatar" width={48} height={48} className="object-cover w-full h-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#00F0FF]/50 uppercase tracking-widest font-orbitron mb-0.5">Player</p>
                    <p className="text-[#00F0FF] font-orbitron font-semibold text-sm tracking-wide truncate">{displayName}</p>
                  </div>
                  <ChevronRight size={16} className="text-[#00F0FF]/40 shrink-0" />
                </Link>
              )}

              {isMiniPay && !isConnected && (
                <p className="text-center text-xs text-[#00F0FF]/60 font-medium mb-4">
                  Connecting via MiniPay...
                </p>
              )}

              {/* Menu label */}
              <p className="text-[#00F0FF]/40 font-orbitron text-[10px] uppercase tracking-[0.25em] mb-2 px-1">
                Navigation
              </p>

              <nav className="space-y-1.5 mb-5">
                {navItem('/', <House size={18} />, 'Home')}
                {navItem('/leaderboard', <Trophy size={18} />, 'Leaderboard', 'text-amber-400/90')}
                {navItem('/how-to-play', <BookOpen size={18} />, 'How to Play')}

                {hasGameSession && navItem(shopHref, <ShoppingBag size={18} />, 'Perk Shop', 'text-emerald-400/90')}
                {hasGameSession && navItem('/tournaments', <Trophy size={18} />, 'Tournaments')}
                {hasGameSession && navItem('/agent-tournaments', <Bot size={18} />, 'Agent Tournaments')}
                {hasGameSession && navItem('/arena', <Bot size={18} />, 'Agents')}
                {hasGameSession && navItem('/rooms', <MessageCircle size={18} />, 'Rooms')}
              </nav>

              {/* Legal & support — smaller, grouped */}
              <p className="text-[#00F0FF]/40 font-orbitron text-[10px] uppercase tracking-[0.25em] mb-2 px-1">
                Legal & Support
              </p>
              <nav className="space-y-1.5 mb-5">
                {navItem('/terms', <FileText size={18} />, 'Terms of Service')}
                {navItem('/privacy', <Shield size={18} />, 'Privacy Policy')}
                <a
                  href="https://t.me/+xJLEjw9tbyQwMGVk"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-3.5 px-4 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#E0F7F7] font-medium transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#003B3E]/60 flex items-center justify-center text-[#00F0FF]/90 shrink-0">
                    <LifeBuoy size={18} />
                  </div>
                  <span className="flex-1">Support (Telegram)</span>
                  <ChevronRight size={14} className="text-[#00F0FF]/30" />
                </a>
              </nav>

              {/* Network & auth */}
              {!isMiniPay && (
                <>
                  <button
                    onClick={() => { setIsNetworkModalOpen(true); closeMobileMenu(); }}
                    className="flex items-center gap-4 py-3.5 px-4 rounded-xl bg-[#011112]/70 hover:bg-[#022a2c]/80 border border-transparent hover:border-[#00F0FF]/25 text-[#E0F7F7] font-medium transition-all duration-200 w-full text-left mb-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#003B3E]/60 flex items-center justify-center text-[#00F0FF]/90 shrink-0">
                      <Globe size={18} />
                    </div>
                    <span className="flex-1 truncate">{networkDisplay}</span>
                    <ChevronRight size={14} className="text-[#00F0FF]/30" />
                  </button>

                  {isConnected ? (
                    <button
                      onClick={() => { setIsDisconnectModalOpen(true); closeMobileMenu(); }}
                      className="w-full py-3.5 rounded-xl bg-red-950/50 hover:bg-red-900/40 border border-red-500/40 text-red-400 font-orbitron font-medium transition-all duration-200"
                    >
                      Disconnect Wallet
                    </button>
                  ) : guestUser ? (
                    <button
                      onClick={() => { signOutGuestAndPrivy(); closeMobileMenu(); }}
                      className="w-full py-3.5 rounded-xl bg-[#011112]/80 hover:bg-[#022a2c]/80 border border-[#003B3E]/60 text-[#00F0FF] font-orbitron font-medium transition-all duration-200"
                    >
                      {guestUser.username} · Sign out
                    </button>
                  ) : isPrivyAuthed ? (
                    <button
                      onClick={() => { signOutGuestAndPrivy(); closeMobileMenu(); }}
                      className="w-full py-3.5 rounded-xl bg-[#011112]/80 hover:bg-[#022a2c]/80 border border-[#003B3E]/60 text-[#00F0FF] font-orbitron font-medium transition-all duration-200"
                    >
                      {typeof user?.email === 'string' ? user.email : (user?.email as { address?: string })?.address ?? 'Signed in'} · Log out
                    </button>
                  ) : (
                    <button
                      onClick={() => { login(); closeMobileMenu(); }}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#00F0FF]/25 to-[#0FF0FC]/20 border border-[#00F0FF]/50 text-[#00F0FF] font-orbitron font-bold text-lg tracking-wide hover:from-[#00F0FF]/35 hover:shadow-[0_0_24px_rgba(0,240,255,0.2)] active:scale-[0.99] transition-all duration-200"
                    >
                      Sign in
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="absolute top-4 right-4 min-w-[44px] min-h-[44px] rounded-xl bg-[#011112]/90 border border-[#003B3E]/60 flex items-center justify-center text-white/90 hover:bg-[#022a2c] hover:border-[#00F0FF]/25 hover:text-[#00F0FF] transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>
          </motion.div>
        </>
      )}

      <NetworkSwitcherModal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)} />
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
      <WalletDisconnectModal isOpen={isDisconnectModalOpen} onClose={() => setIsDisconnectModalOpen(false)} />
    </>
  );
};

export default NavBarMobile;
