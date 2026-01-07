"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api"; // Assuming this is available from the existing code

const WaitlistForm = () => {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !wallet) {
      toast.error("Please fill in both fields");
      return;
    }

    // Simple validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Invalid email address");
      return;
    }

    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(wallet)) {
      toast.error("Invalid wallet address (should be 0x followed by 40 hex characters)");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/waitlist", { email, wallet, game: "tycoon" });
      toast.success("Successfully joined the waitlist!");
      setEmail("");
      setWallet("");
    } catch (error) {
      toast.error("Failed to join waitlist. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6 text-center">Join Tycoon Waitlist</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            placeholder="your@email.com"
            required
          />
        </div>
        <div>
          <label htmlFor="wallet" className="block text-sm font-medium text-gray-300 mb-1">
            Wallet Address
          </label>
          <input
            id="wallet"
            type="text"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            placeholder="0x..."
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-cyan-600 text-white font-bold rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition"
        >
          {isSubmitting ? "Submitting..." : "Join Waitlist"}
        </button>
      </form>
    </div>
  );
};

export default WaitlistForm;