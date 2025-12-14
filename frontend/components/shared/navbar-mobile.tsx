'use client';

import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, User, ShoppingBag, Globe, Menu, X } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount } from '@reown/appkit/react';
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
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 bg-[#0FF0FC] origin-[0%] h-[2px] z-[60]"
        style={{ scaleX }}
      />

      {/* Desktop Navbar - Hidden on mobile */}
      <header className="hidden md:flex w-full h-[87px] items-center justify-between px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm z-50">
        <Logo className="cursor-pointer w-[50px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-4">
          {isConnected && (
            <>
              <button className="w-[133px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center gap-2 bg-[#011112] text-[#AFBAC0]">
                <User className="w-4 h-4" />
                <span className="text-xs font-dmSans">0 friends</span>
              </button>

              <Link href="/profile" className="w-[80px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center gap-2 bg-[#011112] text-[#00F0FF]">
                <User className="w-4 h-4" />
                <span className="text-xs font-dmSans">Profile</span>
              </Link>

              <Link href="/game-shop" className="w-[70px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center gap-2 bg-[#011112] text-[#0FF0FC]">
                <ShoppingBag className="w-4 h-4" />
                <span className="text-xs font-dmSans">Shop</span>
              </Link>
            </>
          )}

          <Link href="/" className="w-10 h-10 border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center bg-[#011112]">
            <House className="w-4 h-4" />
          </Link>

          <button onClick={toggleSound} className="w-10 h-10 border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center bg-[#011112]">
            {isSoundPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeOff className="w-4 h-4" />}
          </button>

          {/* Wallet Section - Desktop */}
          {!isConnected ? (
            <button onClick={() => setIsConnectModalOpen(true)} className="px-6 py-3 rounded-[12px] bg-[#0FF0FC]/80 hover:bg-[#0FF0FC] text-[#0D191B] font-medium transition">
              Connect
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button onClick={() => setIsNetworkModalOpen(true)} className="px-4 py-3 rounded-[12px] bg-[#003B3E] hover:bg-[#005458] border border-[#00F0FF]/30 text-[#00F0FF] font-orbitron text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Network
              </button>

              <div className="flex items-center gap-3 px-5 py-3 rounded-[12px] border border-[#0E282A] bg-[#011112] text-[#00F0FF] font-orbitron">
                <div className="h-8 w-8 rounded-full border-2 border-[#0FF0FC] overflow-hidden">
                  <Image src={avatar} alt="Avatar" width={32} height={32} className="object-cover" />
                </div>
                <span className="text-sm">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                </span>
              </div>

              <button onClick={() => setIsDisconnectModalOpen(true)} className="px-4 py-3 rounded-[12px] bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-600/40 font-medium text-sm">
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navbar - Visible only on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-[70px] flex items-center justify-between px-4 bg-[linear-gradient(180deg,rgba(1,15,16,0.3)_0%,rgba(8,50,52,0.3)_100%)] backdrop-blur-md z-50 border-b border-[#003B3E]/30">
        <Logo className="w-[40px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-3">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="w-10 h-10 rounded-xl bg-[#011112]/80 border border-[#003B3E] flex items-center justify-center text-white"
          >
            {isSoundPlaying ? <Volume2 size={18} /> : <VolumeOff size={18} />}
          </button>

          {/* Hamburger Menu */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 rounded-xl bg-[#011112]/80 border border-[#003B3E] flex items-center justify-center text-[#00F0FF]"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Sheet Menu */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[55] md:hidden"
            onClick={closeMobileMenu}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-[#010F10]/95 backdrop-blur-xl rounded-t-3xl border-t border-[#003B3E] z-[60] md:hidden overflow-hidden"
          >
            <div className="p-6 pb-8">
              {/* Handle bar */}
              <div className="w-12 h-1.5 bg-[#00F0FF]/40 rounded-full mx-auto mb-6" />

              {/* Wallet Status - Prominent */}
              {!isConnected ? (
                <button
                  onClick={() => {
                    setIsConnectModalOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full py-4 rounded-2xl bg-[#0FF0FC]/20 hover:bg-[#0FF0FC]/30 border border-[#00F0FF]/50 text-[#00F0FF] font-orbitron text-lg font-medium mb-6"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="mb-6 space-y-4">
                  {/* Address + Avatar */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-[#011112] border border-[#003B3E]">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full border-2 border-[#0FF0FC] overflow-hidden">
                        <Image src={avatar} alt="Avatar" width={40} height={40} className="object-cover" />
                      </div>
                      <span className="text-[#00F0FF] font-orbitron">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                      </span>
                    </div>
                  </div>

                  {/* Network Switcher */}
                  <button
                    onClick={() => {
                      setIsNetworkModalOpen(true);
                      closeMobileMenu();
                    }}
                    className="w-full py-4 rounded-2xl bg-[#003B3E]/50 hover:bg-[#003B3E] border border-[#00F0FF]/30 text-[#00F0FF] font-orbitron flex items-center justify-center gap-3"
                  >
                    <Globe size={20} />
                    Change Network
                  </button>
                </div>
              )}

              {/* Navigation Links */}
              <div className="space-y-3">
                <Link
                  href="/"
                  onClick={closeMobileMenu}
                  className="flex items-center gap-4 py-4 px-5 rounded-2xl bg-[#011112]/50 hover:bg-[#011112] text-white font-medium"
                >
                  <House size={20} />
                  Home
                </Link>

                {isConnected && (
                  <>
                    <Link
                      href="/profile"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-4 py-4 px-5 rounded-2xl bg-[#011112]/50 hover:bg-[#011112] text-[#00F0FF] font-medium"
                    >
                      <User size={20} />
                      Profile
                    </Link>

                    <Link
                      href="/game-shop"
                      onClick={closeMobileMenu}
                      className="flex items-center gap-4 py-4 px-5 rounded-2xl bg-[#011112]/50 hover:bg-[#011112] text-[#0FF0FC] font-medium"
                    >
                      <ShoppingBag size={20} />
                      Shop
                    </Link>
                  </>
                )}
              </div>

              {/* Disconnect Button (if connected) */}
              {isConnected && (
                <button
                  onClick={() => {
                    setIsDisconnectModalOpen(true);
                    closeMobileMenu();
                  }}
                  className="w-full mt-8 py-4 rounded-2xl bg-red-900/30 hover:bg-red-900/50 border border-red-600/40 text-red-400 font-orbitron font-medium"
                >
                  Disconnect Wallet
                </button>
              )}

              {/* Close Button */}
              <button
                onClick={closeMobileMenu}
                className="absolute top-4 right-4 p-2 rounded-xl bg-[#011112]/50 text-white"
              >
                <X size={24} />
              </button>
            </div>
          </motion.div>
        </>
      )}

      {/* Modals */}
      <NetworkSwitcherModal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)} />
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
      <WalletDisconnectModal isOpen={isDisconnectModalOpen} onClose={() => setIsDisconnectModalOpen(false)} />
    </>
  );
};

export default NavBarMobile;