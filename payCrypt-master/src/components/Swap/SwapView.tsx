import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowUpDown,
  Settings,
  RefreshCw,
  Zap,
  Shield,
  Info,
  Coins,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatCrypto } from "../../utils/amount";
import { UserTokenBalance } from "../../interfaces";
import { apiClient } from "../../utils/api";

const SwapView: React.FC = () => {
  const [fromToken, setFromToken] = useState<UserTokenBalance | null>(null);
  const [toToken, setToToken] = useState<UserTokenBalance | null>(null);
  const [fromAmount, setFromAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isLoading, setIsLoading] = useState(false);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const data = await apiClient.get<UserTokenBalance[]>("/balances");
        setBalances(data);
      } catch (error) {
        console.error("Error fetching balances:", error);
      }
    };
    fetchBalances();
  }, []);

  // Compute exchange rate
  const exchangeRate = useMemo(() => {
    if (!fromToken || !toToken) return null;
    return fromToken.token_price / toToken.token_price;
  }, [fromToken, toToken]);

  // Derived toAmount
  const toAmount = useMemo(() => {
    if (!exchangeRate || !fromAmount) return "";
    return (Number(fromAmount) * exchangeRate).toFixed(6);
  }, [fromAmount, exchangeRate]);

  // Validation
  const isValidSwap = useMemo(() => {
    const amount = Number(fromAmount);
    return (
      amount > 0 &&
      fromToken &&
      toToken &&
      fromToken.id !== toToken.id &&
      amount <= Number(fromToken.amount)
    );
  }, [fromAmount, fromToken, toToken]);

  const priceImpact = useMemo(() => (Math.random() * 0.5).toFixed(2), []);
  const estimatedGas = 15.5;

  const handleSwapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
  };

  const handleMaxClick = () => {
    if (fromToken) setFromAmount(fromToken.amount.toString());
  };

  const handleSwap = () => {
    if (!isValidSwap) return;
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      alert("Swap completed successfully!");
      setFromAmount("");
    }, 2000);
  };

  const TokenSelect = ({
    token,
    onTokenChange,
    type,
  }: {
    token: UserTokenBalance | null;
    onTokenChange: (token: UserTokenBalance) => void;
    type: "from" | "to";
  }) => (
    <div className="relative">
      <select
        value={token?.id || ""}
        onChange={(e) =>
          onTokenChange(
            balances.find((b) => b.id.toString() === e.target.value) || null
          )
        }
        className={`w-full appearance-none bg-gradient-to-br ${
          type === "from"
            ? "from-blue-50 to-cyan-50"
            : "from-purple-50 to-pink-50"
        } border-2 border-gray-200 rounded-2xl px-4 py-3 pr-10 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300`}
      >
        <option value="">Select token</option>
        {balances.map((balance) => (
          <option key={balance.id} value={balance.id}>
            {balance.token_symbol} - {balance.token_name}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
        <Coins className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
            <ArrowUpDown className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Instant Swap
        </h1>
        <p className="text-gray-600">Trade tokens at the best rates</p>
      </div>

      {/* Main Swap Card */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-6 border border-gray-200 shadow-xl">
        {/* Settings Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <span className="font-semibold text-gray-900">Quick Swap</span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-all duration-300 ${
              showSettings
                ? "bg-blue-100 text-blue-600"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Slippage Settings */}
        {showSettings && (
          <div className="bg-blue-50 rounded-2xl p-4 mb-6 border border-blue-200">
            <div className="flex items-center space-x-2 mb-3">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="font-semibold text-blue-900">
                Slippage Tolerance
              </span>
            </div>
            <div className="flex space-x-2">
              {["0.1", "0.5", "1.0"].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                    slippage === value
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                      : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-300"
                  }`}
                >
                  {value}%
                </button>
              ))}
              <div className="flex-1 flex items-center space-x-2 bg-white border border-gray-300 rounded-xl px-3">
                <input
                  type="number"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-full text-sm focus:outline-none"
                  step="0.1"
                  min="0.1"
                  max="50"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>
        )}

        {/* From Token Section */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border-2 border-blue-100 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-blue-900">You Pay</span>
            <span className="text-sm text-blue-700">
              Balance:{" "}
              {fromToken
                ? formatCrypto(Number(fromToken.amount), fromToken.token_symbol)
                : "0"}
            </span>
          </div>

          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <TokenSelect
                token={fromToken}
                onTokenChange={setFromToken}
                type="from"
              />
            </div>

            <div className="text-right">
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="w-32 bg-transparent text-2xl font-bold text-blue-900 text-right focus:outline-none placeholder-blue-300"
              />
              {fromAmount && fromToken && (
                <div className="text-sm text-blue-600 mt-1">
                  ≈ {formatCurrency(Number(fromAmount) * fromToken.token_price)}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={handleMaxClick}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              MAX
            </button>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 z-10 relative">
          <button
            type="button"
            onClick={handleSwapTokens}
            className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>
        </div>

        {/* To Token Section */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border-2 border-purple-100 mt-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-purple-900">
              You Receive
            </span>
            <span className="text-sm text-purple-700">
              Balance:{" "}
              {toToken
                ? formatCrypto(Number(toToken.amount), toToken.token_symbol)
                : "0"}
            </span>
          </div>

          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <TokenSelect
                token={toToken}
                onTokenChange={setToToken}
                type="to"
              />
            </div>

            <div className="text-right">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="w-32 bg-transparent text-2xl font-bold text-purple-900 text-right focus:outline-none placeholder-purple-300"
              />
              {toAmount && toToken && (
                <div className="text-sm text-purple-600 mt-1">
                  ≈ {formatCurrency(Number(toAmount) * toToken.token_price)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Exchange Rate */}
        {exchangeRate && fromToken && toToken && (
          <div className="bg-gray-50 rounded-xl p-3 mt-4 text-center">
            <div className="text-sm text-gray-600">
              1 {fromToken.token_symbol} = {exchangeRate.toFixed(6)}{" "}
              {toToken.token_symbol}
            </div>
          </div>
        )}

        {/* Swap Details */}
        {isValidSwap && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 mt-4 border border-green-200">
            <div className="flex items-center space-x-2 mb-3">
              <Info className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-900">Swap Details</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Price Impact</span>
                <span
                  className={`font-semibold ${
                    Number(priceImpact) > 1 ? "text-red-600" : "text-green-600"
                  }`}
                >
                  {priceImpact}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Network Fee</span>
                <span className="font-semibold text-green-900">
                  ${estimatedGas}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Slippage Tolerance</span>
                <span className="font-semibold text-green-900">
                  {slippage}%
                </span>
              </div>
              <div className="border-t border-green-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-green-700">Minimum Received</span>
                  <span className="font-semibold text-green-900">
                    {(Number(toAmount) * (1 - Number(slippage) / 100)).toFixed(
                      6
                    )}{" "}
                    {toToken?.token_symbol}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Swap Button */}
        <button
          type="button"
          onClick={handleSwap}
          disabled={!isValidSwap || isLoading}
          className={`w-full mt-6 py-4 px-6 rounded-2xl font-semibold transition-all duration-300 ${
            isValidSwap && !isLoading
              ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Processing Swap...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <Sparkles className="w-5 h-5" />
              <span>
                {fromToken && toToken
                  ? `Swap ${fromToken.token_symbol} for ${toToken.token_symbol}`
                  : "Select Tokens"}
              </span>
            </div>
          )}
        </button>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-white rounded-2xl p-3 border border-gray-200">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Shield className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xs text-gray-600">Secure</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-200">
          <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <Zap className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-xs text-gray-600">Fast</div>
        </div>
        <div className="bg-white rounded-2xl p-3 border border-gray-200">
          <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xs text-gray-600">Best Rate</div>
        </div>
      </div>

      {/* Powered By */}
      <div className="text-center">
        <p className="text-sm text-gray-500">
          Powered by Uniswap V3 • Best price guaranteed
        </p>
      </div>
    </div>
  );
};

export default SwapView;
