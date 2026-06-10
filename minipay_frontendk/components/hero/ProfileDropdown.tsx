"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface ProfileDropdownProps {
  username: string;
  onSignOut: () => void;
}

export function ProfileDropdown({ username, onSignOut }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative z-50">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0E1415] border border-[#003B3E] hover:border-[#00F0FF]/50 transition-colors duration-300"
      >
        <span className="text-sm font-orbitron text-[#00F0FF] truncate max-w-[150px]">
          {username}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-[#00F0FF]/70" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-2 w-48 bg-[#010F10] border border-[#003B3E] rounded-lg shadow-lg shadow-cyan-500/10 overflow-hidden"
          >
            <div className="py-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onSignOut();
                }}
                className="w-full px-4 py-2 text-left text-sm font-dmSans text-[#869298] hover:text-[#00F0FF] hover:bg-[#0E282A] transition-colors duration-200"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
