import React, { useEffect, useState, useMemo } from "react";
import {
  ArrowUpRight,
  AlertTriangle,
  CreditCard,
  Wallet,
  ChevronDown,
  Tag,
  Send,
  Banknote,
  Coins,
  Zap,
  Shield,
  CheckCircle2,
  Info,
} from "lucide-react";
import { formatCurrency, formatCrypto } from "../../utils/amount";
import { UserTokenBalance } from "../../interfaces";
import { apiClient } from "../../utils/api";

type WithdrawType = "wallet" | "fiat" | "tag";
interface DepositResponse {
  data: "success";
  tx: {
    transaction_hash: string;
  };
}

const WithdrawView: React.FC = () => {
  const [withdrawType, setWithdrawType] = useState<WithdrawType>("wallet");
  const [selectedBalance, setSelectedBalance] =
    useState<UserTokenBalance | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientTag, setRecipientTag] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<UserTokenBalance[]>("/balances")
      .then(setBalances)
      .catch((err) => console.error("Error fetching balances:", err))
      .finally(() => setLoading(false));
  }, []);

  const maxAmount = selectedBalance ? Number(selectedBalance.amount) : 0;
  const inputAmount = Number(amount) || 0;

  const fees = useMemo(() => {
    const baseFee = 0.05;
    const platformFee = inputAmount * 0.001;
    const fiatFee = withdrawType === "fiat" ? 5 : 0;
    return {
      baseFee,
      platformFee,
      fiatFee,
      total: baseFee + platformFee + fiatFee,
    };
  }, [inputAmount, withdrawType]);

  const isValidAmount = inputAmount > 0 && inputAmount <= maxAmount;
  const isValidRecipient =
    withdrawType === "wallet"
      ? recipientAddress.trim().length > 0
      : withdrawType === "tag"
      ? recipientTag.trim().length > 0
      : bankAccount.trim().length > 0;

  const handleWithdraw = async () => {
    if (withdrawType === "tag") {
      try {
        setIsProcessing(true);
        const response = await apiClient.post<DepositResponse>(
          "/wallets/deposit",
          {
            balance_id: selectedBalance?.id,
            amount: amount,
            receiver_tag: recipientTag,
          }
        );
        setIsProcessing(false);
        if (response.data === "success" && response.tx) {
          const txHash = response.tx.transaction_hash;
          alert(`Deposit successful!\nTransaction Hash: ${txHash}`);
        } else {
          alert("Deposit failed. Please try again.");
        }
      } catch (error) {
        setIsProcessing(false);
        alert(
          error instanceof Error
            ? error.message
            : "Failed to submit deposit. Please try again."
        );
      }
    } else {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        alert("Withdrawal initiated successfully!");
      }, 2000);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Send Funds
        </h1>
        <p className="text-gray-500 mt-2">Transfer crypto or cash instantly</p>
      </div>

      {/* Withdraw Type Selection */}
      <div className="bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
        <div className="flex space-x-1">
          <WithdrawMethodTab
            type="wallet"
            label="Wallet"
            active={withdrawType === "wallet"}
            onClick={() => setWithdrawType("wallet")}
            icon={<Send className="w-4 h-4" />}
          />
          <WithdrawMethodTab
            type="tag"
            label="Tag"
            active={withdrawType === "tag"}
            onClick={() => setWithdrawType("tag")}
            icon={<Tag className="w-4 h-4" />}
          />
          <WithdrawMethodTab
            type="fiat"
            label="Bank"
            active={withdrawType === "fiat"}
            onClick={() => setWithdrawType("fiat")}
            icon={<Banknote className="w-4 h-4" />}
          />
        </div>
      </div>

      <div className="space-y-4">
        {/* Asset Selection */}
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
            <Coins className="w-4 h-4 text-blue-500" />
            <span>Select Asset</span>
          </label>
          <div className="relative">
            <select
              value={selectedBalance?.id ?? ""}
              onChange={(e) =>
                setSelectedBalance(
                  balances.find((b) => b.id.toString() === e.target.value) ||
                    null
                )
              }
              className="w-full p-3 border border-gray-300 rounded-xl appearance-none bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose cryptocurrency</option>
              {balances.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.token_name} ({b.token_symbol}) -{" "}
                  {formatCrypto(Number(b.amount), b.token_symbol)}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>

        {/* Amount Input */}
        {selectedBalance && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <Zap className="w-4 h-4 text-green-500" />
              <span>Amount</span>
            </label>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                  <span className="text-sm text-gray-500 font-medium">
                    {selectedBalance.token_symbol}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAmount(maxAmount.toString())}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded-lg font-medium hover:bg-blue-200 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Available:{" "}
                  {formatCrypto(maxAmount, selectedBalance.token_symbol)}
                </span>
                {amount && (
                  <span className="text-gray-600">
                    ≈{" "}
                    {formatCurrency(
                      (inputAmount / maxAmount) *
                        Number(selectedBalance.usd_value)
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recipient Details */}
        {selectedBalance && (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <Send className="w-4 h-4 text-purple-500" />
              <span>
                {withdrawType === "wallet"
                  ? "Recipient Address"
                  : withdrawType === "tag"
                  ? "Recipient Tag"
                  : "Bank Details"}
              </span>
            </label>

            {withdrawType === "wallet" && (
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="Enter wallet address (0x...)"
                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            )}

            {withdrawType === "tag" && (
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  @
                </div>
                <input
                  type="text"
                  value={recipientTag}
                  onChange={(e) => setRecipientTag(e.target.value)}
                  placeholder="username"
                  className="w-full p-4 pl-8 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {withdrawType === "fiat" && (
              <div className="space-y-3">
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Account Number"
                  className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <select className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option value="">Select Bank</option>
                  <option value="gtbank">GTBank</option>
                  <option value="access">Access Bank</option>
                  <option value="zenith">Zenith Bank</option>
                  <option value="first">First Bank</option>
                  <option value="uba">UBA</option>
                </select>
              </div>
            )}
          </div>
        )}

        {/* Fee Breakdown */}
        {selectedBalance && amount && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-5 border border-blue-200">
            <div className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
              <Info className="w-4 h-4 text-blue-500" />
              <span>Fee Breakdown</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-blue-100">
                <span className="text-gray-600">Network Fee</span>
                <span className="font-semibold">
                  ${fees.baseFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-blue-100">
                <span className="text-gray-600">Platform Fee (1%)</span>
                <span className="font-semibold">
                  {formatCurrency(fees.platformFee)}
                </span>
              </div>
              {withdrawType === "fiat" && (
                <div className="flex justify-between py-2 border-b border-blue-100">
                  <span className="text-gray-600">Fiat Conversion</span>
                  <span className="font-semibold">
                    ${fees.fiatFee.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-bold text-gray-900">
                <span>Total Fees</span>
                <span>${fees.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Security Alert */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold text-amber-800 mb-1">
                Security Notice
              </div>
              <ul className="text-amber-700 space-y-1">
                <li>• Transactions are irreversible once confirmed</li>
                <li>• Double-check all recipient details</li>
                <li>• Contact support for any issues</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={!isValidAmount || !isValidRecipient || isProcessing}
          className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
            isValidAmount && isValidRecipient && !isProcessing
              ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing Transaction...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <ArrowUpRight className="w-5 h-5" />
              <span>
                {withdrawType === "wallet"
                  ? "Send to Wallet"
                  : withdrawType === "tag"
                  ? "Send to Tag"
                  : "Withdraw to Bank"}
              </span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

// Enhanced Withdraw Method Tab
const WithdrawMethodTab: React.FC<{
  type: WithdrawType;
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}> = ({ label, active, onClick, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
      active
        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-sm"
        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

export default WithdrawView;
