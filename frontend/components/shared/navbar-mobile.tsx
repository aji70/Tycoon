'use client';

import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, User, ShoppingBag, Globe, Menu, X } from 'lucide-react';
import useSound from 'use-sound';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { PiUserCircle } from 'react-icons/pi';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';
import NetworkSwitcherModal from './network-switcher-modal';

const NavBar = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork, chainId } = useAppKitNetwork();
  const networkDisplay = caipNetwork?.name ?? (chainId ? `Chain ${chainId}` : 'Network');

  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [play, { pause }] = useSound('/sound/monopoly-theme.mp3', {
    volume: 0.5,
    loop: true,
  });

  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        className="fixed top-0 left-0 right-0 bg-[#0FF0FC] origin-[0%] h-[2px] z-[60]"
        style={{ scaleX }}
      />

      {/* Desktop Navbar - Hidden on Mobile */}
      <header className="hidden md:flex w-full h-[87px] items-center justify-between px-8 bg-[linear-gradient(180deg,rgba(1,15,16,0.12)_0%,rgba(8,50,52,0.12)_100%)] backdrop-blur-sm z-50">
        <Logo className="cursor-pointer w-[50px]" image={LogoIcon} href="/" />

        <div className="flex items-center gap-4">
          {isConnected && (
            <>
              <button className="w-[133px] h-[40px] border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] flex justify-center items-center gap-2 bg-[#011112] text-[#AFBAC0]">
                <PiUserCircle className="w-4 h-4" />
                <span className="text-xs font-dmSans">0 friends online</span>
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

          <Link href="/" className="w-10 h-10 border border-[#0E282A] hover:border-[#003B3E] rounded-xl flex items-center justify-center bg-[#011112]">
            <House className="w-4 h-4 text-white" />
          </Link>

          <button onClick={toggleSound} className="w-10 h-10 border border-[#0E282A] hover:border-[#003B3E] rounded-xl flex items-center justify-center bg-[#011112]">
            {isSoundPlaying ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeOff className="w-4 h-4 text-white" />}
          </button>

          {/* Wallet Section - Desktop */}
          {!isConnected ? (
            <button onClick={() => setIsConnectModalOpen(true)} className="px-6 py-3 rounded-xl bg-[#0FF0FC]/80 hover:bg-[#0FF0FC] text-[#0D191B] font-bold transition">
              Connect
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <button onClick={() => setIsNetworkModalOpen(true)} className="px-5 py-3 rounded-xl bg-[#003B3E] hover:bg-[#005458] border border-[#00F0FF]/30 text-[#00F0FF] font-orbitron text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" />
                <span className="truncate max-w-32">{networkDisplay}</span>
              </button>

              <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-[#0E282A] bg-[#011112] text-[#00F0FF]">
                <div className="w-8 h-8 rounded-full border-2 border-[#0FF0FC] overflow-hidden">
                  <Image src={avatar} alt="Avatar" width={32} height={32} className="object-cover" />
                </div>
                <span className="font-orbitron text-sm">
                  {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                </span>
              </div>

              <button onClick={() => setIsDisconnectModalOpen(true)} className="px-5 py-3 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-600/40 font-medium text-sm">
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Navbar - Fixed Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#010F10]/95 backdrop-blur-lg border-t border-[#003B3E]/50">
        <div className="flex items-center justify-around py-3 px-4">
          {/* Logo + Home */}
          <Link href="/" className="flex flex-col items-center gap-1 text-[#00F0FF]">
            <House className="w-6 h-6" />
            <span className="text-xs font-dmSans">Home</span>
          </Link>

          {/* Sound Toggle */}
          <button onClick={toggleSound} className="flex flex-col items-center gap-1 text-white">
            {isSoundPlaying ? <Volume2 className="w-6 h-6" /> : <VolumeOff className="w-6 h-6" />}
            <span className="text-xs font-dmSans">Sound</span>
          </button>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 text-[#0FF0FC]"
          >
            <Menu className="w-6 h-6" />
            <span className="text-xs font-dmSans">Menu</span>
          </button>

          {/* Wallet / Connect */}
          {!isConnected ? (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-6 py-2 rounded-full bg-[#0FF0FC] text-[#010F10] font-bold text-sm"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={() => setIsNetworkModalOpen(true)}
              className="flex flex-col items-center gap-1 text-[#00F0FF]"
            >
              <Globe className="w-6 h-6" />
              <span className="text-xs font-orbitron truncate max-w-20">{networkDisplay}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Slide-Up Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-[#010F10]/90 backdrop-blur-md">
          <div className="absolute bottom-0 left-0 right-0 bg-[#011112] rounded-t-3xl border-t border-[#003B3E] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-[#003B3E]/50">
              <Logo className="w-10" image={LogoIcon} href="/" />
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-white">
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isConnected && (
                <>
                  {/* Connected User Info */}
                  <div className="flex items-center gap-4 p-4 bg-[#0E1415] rounded-xl">
                    <div className="w-12 h-12 rounded-full border-2 border-[#0FF0FC] overflow-hidden">
                      <Image src={avatar} alt="Avatar" width={48} height={48} className="object-cover" />
                    </div>
                    <div>
                      <p className="text-[#00F0FF] font-orbitron text-sm">
                        {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                      </p>
                      <p className="text-[#AFBAC0] text-xs font-dmSans">Wallet Connected</p>
                    </div>
                  </div>

                  <Link href="/profile" className="flex items-center gap-4 p-4 bg-[#0E1415] rounded-xl text-[#00F0FF]" onClick={() => setIsMobileMenuOpen(false)}>
                    <User className="w-6 h-6" />
                    <span className="font-dmSans">Profile</span>
                  </Link>

                  <Link href="/game-shop" className="flex items-center gap-4 p-4 bg-[#0E1415] rounded-xl text-[#0FF0FC]" onClick={() => setIsMobileMenuOpen(false)}>
                    <ShoppingBag className="w-6 h-6" />
                    <span className="font-dmSans">Shop</span>
                  </Link>

                  <button className="flex items-center gap-4 p-4 bg-[#0E1415] rounded-xl text-[#AFBAC0] w-full">
                    <PiUserCircle className="w-6 h-6" />
                    <span className="font-dmSans">0 friends online</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsDisconnectModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-4 rounded-xl bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-600/40 font-medium"
                  >
                    Disconnect Wallet
                  </button>
                </>
              )}

              {!isConnected && (
                <button
                  onClick={() => {
                    setIsConnectModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full py-4 rounded-xl bg-[#0FF0FC] text-[#010F10] font-bold"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <NetworkSwitcherModal isOpen={isNetworkModalOpen} onClose={() => setIsNetworkModalOpen(false)} />
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
      <WalletDisconnectModal isOpen={isDisconnectModalOpen} onClose={() => setIsDisconnectModalOpen(false)} />
    </>
  );
};

export default NavBar;