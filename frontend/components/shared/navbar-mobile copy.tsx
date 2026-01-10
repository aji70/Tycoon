'use client';

import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, Globe, Menu, X, User, ShoppingBag } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';

const NavBarMobile = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();

  // Use caipNetwork?.name for the full/pretty name (e.g., "Ethereum", "Base", "Polygon")
  // Falls back to "Chain ${chainId}" for testnets/unknown, then "Change Network"
  const networkDisplay = caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : 'Change Network');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

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

  return (
    <>
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 bg-[#0FF0FC] h-[3px] origin-left z-[70]"
        style={{ scaleX }}
      />

      {/* Mobile Fixed Header */}
      <header className="fixed top-0 left-0 right-0 h-[80px] pt-safe flex items-center justify-between px-5 bg-[#010F10]/80 backdrop-blur-xl z-[1000] border-b border-[#003B3E]/50">
        <Logo className="w-[42px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-4">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="w-12 h-12 rounded-2xl bg-[#011112]/90 border border-[#003B3E] flex items-center justify-center text-white hover:bg-[#003B3E]/50 transition"
          >
            {isSoundPlaying ? <Volume2 size={22} /> : <VolumeOff size={22} />}
          </button>

          {/* Hamburger Menu */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-12 h-12 rounded-2xl bg-[#011112]/90 border border-[#003B3E] flex items-center justify-center text-[#00F0FF] hover:bg-[#003B3E]/50 transition"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Sheet Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[55]"
            onClick={closeMobileMenu}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 pb-safe bg-[#010F10]/98 backdrop-blur-2xl rounded-t-3xl border-t border-[#003B3E] z-[60] max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 pb-10">
              {/* Drag Handle */}
              <div className="w-14 h-1.5 bg-[#00F0FF]/50 rounded-full mx-auto mb-8" />

              Wallet Section
              {!isConnected ? (
                <button
                  onClick={() => {
                    setIsConnectModalOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-[#00F0FF]/20 to-[#0FF0FC]/20 border border-[#00F0FF]/60 text-[#00F0FF] font-orbitron text-xl font-bold tracking-wide mb-8 hover:from-[#00F0FF]/30 hover:to-[#0FF0FC]/30 transition"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="mb-8 space-y-5">
                  {/* Connected Address */}
                  <div className="p-5 rounded-2xl bg-[#011112]/80 border border-[#003B3E] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full border-3 border-[#0FF0FC] overflow-hidden shadow-lg">
                        <Image src={avatar} alt="Avatar" width={48} height={48} className="object-cover" />
                      </div>
                      <span className="text-[#00F0FF] font-orbitron text-lg">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                      </span>
                    </div>
                  </div>

                  {/* Network Switcher – Shows the proper network name from caipNetwork.name */}
                  <button
                    onClick={() => {
                      setIsNetworkModalOpen(true);
                      closeMobileMenu();
                    }}
                    className="w-full py-5 rounded-2xl bg-[#003B3E]/70 hover:bg-[#003B3E] border border-[#00F0FF]/40 text-[#00F0FF] font-orbitron text-lg flex items-center justify-center gap-4 transition"
                  >
                    <Globe size={24} />
                    <span className="truncate max-w-[200px]">
                      {networkDisplay}
                    </span>
                  </button>
                </div>
              )}

              {/* Navigation Links */}
              <nav className="space-y-4 mb-10">
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-white text-lg font-medium transition"
                >
                  <House size={24} />
                  Home
                </Link>

                {isConnected && (
                  <>
                    <Link
                      href="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-[#00F0FF] text-lg font-medium transition"
                    >
                      <User size={24} />
                      Profile
                    </Link>

                    <Link
                      href="/game-shop"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-5 py-5 px-6 rounded-2xl bg-[#011112]/60 hover:bg-[#011112] text-[#0FF0FC] text-lg font-medium transition"
                    >
                      <ShoppingBag size={24} />
                      Shop
                    </Link>
                  </>
                )}
              </nav>

              {/* Disconnect Button */}
              {isConnected && (
                <button
                  onClick={() => {
                    setIsDisconnectModalOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full py-5 rounded-2xl bg-red-900/40 hover:bg-red-900/60 border border-red-600/50 text-red-400 font-orbitron text-lg font-medium transition"
                >
                  Disconnect Wallet
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={closeMobileMenu}
                className="absolute top-5 right-5 w-10 h-10 rounded-full bg-[#011112]/70 flex items-center justify-center text-white hover:bg-[#003B3E]/50 transition"
              >
                <X size={26} />
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