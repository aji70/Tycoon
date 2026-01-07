"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api";
import { Mail, Wallet, Sparkles } from "lucide-react";
import { AtSign } from "lucide-react"; // For Telegram icon

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [telegram, setTelegram] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !wallet) {
      toast.error("Email and Wallet are required");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Wallet address validation (Ethereum-style)
    const walletRegex = /^0x[a-fA-F0-9]{40}$/i;
    if (!walletRegex.test(wallet)) {
      toast.error("Invalid wallet address (must be 0x followed by 40 hex characters)");
      return;
    }

    // Optional Telegram validation: must start with @ or be empty
    if (telegram && telegram.trim() !== "") {
      toast.error("Telegram handle should start with @ (e.g., @username)");
      return;
    }

    // Clean up telegram value: ensure it starts with @ if provided
    const cleanedTelegram = telegram.trim();
    const finalTelegram = cleanedTelegram.startsWith("@") ? cleanedTelegram : cleanedTelegram ? `@${cleanedTelegram}` : "";

    setIsSubmitting(true);

    try {
      await apiClient.post("/waitlist", {
        email_address: email,
        wallet_address: wallet,
        telegram_username:  finalTelegram || null, // Send null if empty
      });

      toast.success("Successfully joined the Tycoon waitlist! 🎉");
      setEmail("");
      setWallet("");
      setTelegram("");
    } catch (error: any) {
      console.error("Waitlist submission failed:", error);
      toast.error(error?.response?.data?.message || "Failed to join waitlist. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="max-w-md mx-auto p-8 bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl shadow-2xl border border-cyan-500/30 overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />

      <h2 className="text-3xl font-bold text-white mb-8 text-center flex items-center justify-center gap-3">
        <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
        Join Tycoon Waitlist
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email Field */}
        <div className="relative">
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-cyan-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 transition-all"
              placeholder="your@email.com"
              required
            />
          </div>
        </div>

        {/* Wallet Field */}
        <div className="relative">
          <label htmlFor="wallet" className="block text-sm font-medium text-gray-300 mb-2">
            Wallet Address
          </label>
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
            <input
              id="wallet"
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value.trim())}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-cyan-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/50 transition-all"
              placeholder="0x..."
              required
            />
          </div>
        </div>

        {/* Telegram Field (Optional) */}
        <div className="relative">
          <label htmlFor="telegram" className="block text-sm font-medium text-gray-300 mb-2">
            Telegram Handle <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-400" />
            <input
              id="telegram"
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value.trim())}
              className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-cyan-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 transition-all"
              placeholder="@yourusername"
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 pl-1">
            We'll notify you via Telegram for alpha access and updates
          </p>
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: isSubmitting ? 1 : 1.05 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.95 }}
          className="w-full py-4 bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 disabled:opacity-70 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? "Submitting..." : "Join Waitlist"}
        </motion.button>
      </form>
    </motion.div>
  );
};

export default WaitlistForm;