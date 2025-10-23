'use client';

import { useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import Logo from './logo';
import LogoIcon from '@/public/logo.png';
import Link from 'next/link';
import { House, Volume2, VolumeOff, User, ShoppingBag } from 'lucide-react'; // Added ShoppingBag
import useSound from 'use-sound';
import { useAppKitAccount } from '@reown/appkit/react';
import { PiUserCircle } from 'react-icons/pi';
import Image from 'next/image';
import avatar from '@/public/avatar.jpg';
import WalletConnectModal from './wallet-connect-modal';
import WalletDisconnectModal from './wallet-disconnect-modal';

const NavBar = () => {
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
          {/* Friends button (only when connected) */}
          {isConnected && (
            <button
              type="button"
              className="w-[133px] h-[40px] hidden border border-[#0E282A] hover:border-[#003B3E] rounded-[12px] md:flex justify-center items-center gap-2 bg-[#011112] text-[#AFBAC0]"
            >
              <PiUserCircle className="w-[16px] h-[16px]" />
              <span className="text-[12px] font-[400] font-dmSans">0 friends online</span>
            </button>
          )}

          {/* Profile button (only when connected) - Made bigger with text */}
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

          {/* Wallet Section */}
          {!isConnected ? (
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="px-4 py-2 rounded-[12px] bg-[#0FF0FC]/80 hover:bg-[#0FF0FC]/40 text-[#0D191B] font-medium transition"
            >
              Connect
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Wallet display */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-[12px] border border-[#0E282A] bg-[#011112] text-[#00F0FF] font-orbitron">
                <div className="h-6 w-6 rounded-full border border-[#0FF0FC] overflow-hidden">
                  <Image
                    src={avatar}
                    alt="Wallet Avatar"
                    width={200}
                    height={200}
                    className="object-cover w-full h-full"
                  />
                </div>
                <span className="text-[14px]">
                  {address ? `${address.slice(0, 4)}…${address.slice(-4)}` : 'Connected'}
                </span>
              </div>
              {/* Disconnect button */}
              <button
                onClick={() => setIsDisconnectModalOpen(true)}
                className="px-3 py-2 rounded-[12px] bg-[#003B3E] hover:bg-[#005458] text-[#0FF0FC] text-sm font-medium transition"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

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