import React from "react";
import logo from "@/public/footerLogo.svg";
import Logo from "./logo";
import Link from "next/link";
import { FiFacebook, FiGithub } from "react-icons/fi";
import { RiTwitterXFill } from "react-icons/ri";
import { RxDiscordLogo } from "react-icons/rx";

const Footer = () => {
  return (
    <footer className="w-full md:pb-12 pb-8 px-4">
      <div className="w-full max-w-[1120px] mx-auto flex flex-col md:flex-row items-center md:justify-between justify-center md:gap-0 gap-4 bg-[#0B191A] rounded-[16px] p-[20px] border border-[#003B3E]/50 game-panel">
        <Logo
          className="block md:w-[60px] w-[55px] shrink-0"
          image={logo}
          href="/"
          width={64}
          height={64}
          sizes="(max-width: 768px) 55px, 60px"
          imageClassName="h-auto w-full max-h-[60px] object-contain"
        />

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          <Link
            href="/how-to-play"
            className="text-[#F0F7F7] hover:text-[#00F0FF] text-[12px] font-dmSans font-[400] transition-colors"
          >
            How to Play
          </Link>
          <span className="text-[#455A64] hidden sm:inline">·</span>
          <Link
            href="/terms"
            className="text-[#F0F7F7] hover:text-[#00F0FF] text-[12px] font-dmSans font-[400] transition-colors"
          >
            Terms
          </Link>
          <span className="text-[#455A64] hidden sm:inline">·</span>
          <Link
            href="/privacy"
            className="text-[#F0F7F7] hover:text-[#00F0FF] text-[12px] font-dmSans font-[400] transition-colors"
          >
            Privacy
          </Link>
          <span className="text-[#455A64] hidden sm:inline">·</span>
          <a
            href="https://t.me/+xJLEjw9tbyQwMGVk"
            className="text-[#F0F7F7] hover:text-[#00F0FF] text-[12px] font-dmSans font-[400] transition-colors"
          >
            Support
          </a>
          <span className="text-[#455A64] hidden md:inline">·</span>
          <p className="text-[#F0F7F7] text-[12px] font-dmSans font-[400] w-full md:w-auto text-center md:text-left basis-full md:basis-auto">
            ©{new Date().getFullYear()} Tycoon &bull; All rights reserved.
          </p>
        </div>

        <div className="flex items-center gap-5">
          <Link
            href="https://facebook.com/ajidokwu"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="Facebook"
          >
            <FiFacebook />
          </Link>

          <Link
            href="https://x.com/blockopoly1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="X (Twitter)"
          >
            <RiTwitterXFill />
          </Link>

          <Link
            href="https://github.com/Tyoon"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="GitHub"
          >
            <FiGithub />
          </Link>

          <Link
            href="https://t.me/+xJLEjw9tbyQwMGVk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F0F7F7] hover:text-[#00F0FF] transition-colors duration-300 ease-in-out text-[20px]"
            aria-label="Telegram"
          >
            {/* Note: react-icons doesn't have a Telegram icon in the free set, so keeping Discord as placeholder */}
            {/* If you install react-icons/tg or use a custom SVG, replace RxDiscordLogo with the correct icon */}
            <RxDiscordLogo />
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;