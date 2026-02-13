import React, { useEffect, useState } from "react";
import { apiClient } from "../../utils/api";
import { formatCurrency } from "../../utils/amount";
import {
  ArrowRightLeft,
  Lock,
  Unlock,
  Settings,
  Zap,
  TrendingUp,
  Coins,
  Shield,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Play,
  PieChart,
} from "lucide-react";
import { DashboardSummary, UserTokenBalance } from "../../interfaces";

// Mock conversion history
const CONVERSIONS = [
  {
    from: "ETH",
    to: "NGN",
    amount: "0.5 ETH",
    value: "₦1,960,000",
    time: "2 hours ago",
    status: "completed",
  },
  {
    from: "USDC",
    to: "NGN",
    amount: "200 USDC",
    value: "₦320,000",
    time: "1 day ago",
    status: "completed",
  },
  {
    from: "STRK",
    to: "NGN",
    amount: "100 STRK",
    value: "₦120,000",
    time: "2 days ago",
    status: "completed",
  },
];

const MultiCurrencyView: React.FC = () => {
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [thresholds, setThresholds] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"balances" | "conversions">(
    "balances"
  );

  // Fetch dashboard + balances in parallel
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryData, balanceData] = await Promise.all([
          apiClient.get<DashboardSummary>("/users/dashboard-summary"),
          apiClient.get<UserTokenBalance[]>("/balances"),
        ]);

        setSummary(summaryData);
        setBalances(balanceData);

        // Initialize thresholds state
        const init: Record<number, string> = {};
        balanceData.forEach((b) => {
          init[b.id] = b.auto_convert_threshold ?? "";
        });
        setThresholds(init);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleThresholdChange = (id: number, value: string) => {
    setThresholds((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (
    e: React.FormEvent,
    balance: UserTokenBalance
  ) => {
    e.preventDefault();
    const threshold = thresholds[balance.id];

    if (!threshold) {
      alert("Please enter an amount to auto convert");
      return;
    }

    setIsSubmitting(balance.id);
    try {
      await apiClient.put(`/balances/${balance.id}`, {
        auto_convert_threshold: threshold,
      });
      alert("New threshold set.");
    } catch (error) {
      console.error("Set new threshold failed:", error);
      alert(
        error instanceof Error ? error.message : "Failed to set threshold."
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleQuickSwap = (fromSymbol: string, toSymbol: string) => {
    alert(`Swapping ${fromSymbol} to ${toSymbol}`);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
            <Coins className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Multi-Currency Hub
        </h1>
        <p className="text-gray-600">
          Manage your crypto portfolio with smart automation
        </p>
      </div>

      {/* Portfolio Overview */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-24 translate-y-24"></div>

        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="text-lg font-semibold text-blue-100 mb-2">
                Total Portfolio Value
              </div>
              <div className="text-4xl lg:text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                {formatCurrency(summary?.total_balance ?? 0)}
              </div>
              <div className="flex items-center space-x-2 text-blue-100">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">
                  All assets across all currencies
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                label="Active Currencies"
                value={balances.length.toString()}
                color="from-green-400 to-emerald-500"
              />
              <StatCard
                label="Auto-Convert"
                value={balances
                  .filter((b) => b.auto_convert_threshold)
                  .length.toString()}
                color="from-blue-400 to-cyan-500"
              />
              <div className="hidden lg:block">
                <StatCard
                  label="Total Value"
                  value={formatCurrency(summary?.total_balance ?? 0)}
                  color="from-purple-400 to-pink-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-2xl p-1 border border-gray-200">
        <div className="flex space-x-1">
          <TabButton
            active={activeTab === "balances"}
            onClick={() => setActiveTab("balances")}
            icon={<Coins className="w-4 h-4" />}
            label="Currency Balances"
          />
          <TabButton
            active={activeTab === "conversions"}
            onClick={() => setActiveTab("conversions")}
            icon={<ArrowRightLeft className="w-4 h-4" />}
            label="Conversion History"
          />
        </div>
      </div>

      {activeTab === "balances" ? (
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <QuickAction
              icon={<Zap className="w-5 h-5" />}
              title="Instant Swap"
              description="Exchange between currencies instantly"
              gradient="from-blue-500 to-cyan-500"
              onClick={() => handleQuickSwap("ETH", "NGN")}
            />
            <QuickAction
              icon={<Shield className="w-5 h-5" />}
              title="Auto-Protect"
              description="Set up automatic conversions"
              gradient="from-green-500 to-emerald-500"
              onClick={() => {}}
            />
            <QuickAction
              icon={<PieChart className="w-5 h-5" />}
              title="Portfolio Analytics"
              description="View detailed performance"
              gradient="from-purple-500 to-pink-500"
              onClick={() => {}}
            />
          </div>

          {/* Currency Balances Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {balances.map((balance) => (
              <BalanceCard
                key={balance.id}
                balance={balance}
                threshold={thresholds[balance.id] ?? ""}
                onThresholdChange={handleThresholdChange}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting === balance.id}
                onQuickSwap={handleQuickSwap}
              />
            ))}
          </div>
        </>
      ) : (
        /* Conversion History */
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Conversion History
                </h3>
                <p className="text-gray-600 text-sm">
                  Your recent currency exchanges
                </p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              {CONVERSIONS.length} transactions
            </div>
          </div>

          <div className="space-y-3">
            {CONVERSIONS.map((conversion, index) => (
              <ConversionItem key={index} {...conversion} />
            ))}
          </div>

          {CONVERSIONS.length === 0 && (
            <div className="text-center py-12">
              <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No conversion history yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Your exchanges will appear here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Loading Skeleton
const LoadingSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
    <div className="text-center mb-2">
      <div className="w-12 h-12 bg-gray-300 rounded-2xl mx-auto mb-4"></div>
      <div className="h-8 bg-gray-300 rounded w-64 mx-auto mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-48 mx-auto"></div>
    </div>
    <div className="bg-gray-300 rounded-3xl h-48"></div>
    <div className="bg-gray-200 rounded-2xl h-20"></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-gray-200 rounded-2xl h-80"></div>
      ))}
    </div>
  </div>
);

// Stat Card Component
const StatCard: React.FC<{
  label: string;
  value: string;
  color: string;
}> = ({ label, value, color }) => (
  <div className="text-center">
    <div className="text-sm text-blue-100 mb-1">{label}</div>
    <div className="text-xl font-bold">{value}</div>
  </div>
);

// Tab Button Component
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
      active
        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
        : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

// Quick Action Component
const QuickAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  onClick: () => void;
}> = ({ icon, title, description, gradient, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-gray-300 transition-all duration-300 hover:shadow-lg group text-left"
  >
    <div
      className={`p-3 bg-gradient-to-r ${gradient} rounded-xl w-12 h-12 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
    >
      {icon}
    </div>
    <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
    <p className="text-sm text-gray-600">{description}</p>
  </button>
);

// Balance Card Component
const BalanceCard = ({
  balance,
  threshold,
  onThresholdChange,
  onSubmit,
  isSubmitting,
  onQuickSwap,
}: {
  balance: UserTokenBalance;
  threshold: string;
  onThresholdChange: (id: number, val: string) => void;
  onSubmit: (e: React.FormEvent, balance: UserTokenBalance) => void;
  isSubmitting: boolean;
  onQuickSwap: (from: string, to: string) => void;
}) => {
  const hasAutoConvert = balance.auto_convert_threshold;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <img
            src={balance.token_logo_url}
            alt={balance.token_name}
            className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
            onError={(e) => {
              e.currentTarget.src = `https://cryptologos.cc/logos/default-logo.png`;
            }}
          />
          <div>
            <div className="font-bold text-gray-900">
              {balance.token_symbol}
            </div>
            <div className="text-sm text-gray-500 capitalize">
              {balance.token_name}
            </div>
          </div>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            hasAutoConvert
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {hasAutoConvert ? "Auto-Convert" : "Manual"}
        </div>
      </div>

      {/* Amount Display */}
      <div className="space-y-3 mb-6">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {Number(balance.amount).toLocaleString(undefined, {
              maximumFractionDigits: 6,
            })}
          </div>
          <div className="text-sm text-gray-500">{balance.token_symbol}</div>
        </div>
        <div className="text-lg font-semibold text-gray-700">
          {formatCurrency(Number(balance.usd_value))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex space-x-2 mb-4">
        <button
          type="button"
          onClick={() => onQuickSwap(balance.token_symbol, "NGN")}
          className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-2 px-3 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center space-x-1"
        >
          <Play className="w-3 h-3" />
          <span>Swap All</span>
        </button>
      </div>

      {/* Auto-Convert Form */}
      <form
        onSubmit={(e) => onSubmit(e, balance)}
        className="pt-4 border-t border-gray-200"
      >
        <div className="space-y-3">
          <div>
            <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Auto-Convert Threshold</span>
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={threshold}
              onChange={(e) => onThresholdChange(balance.id, e.target.value)}
              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              placeholder={`Set ${balance.token_symbol} threshold`}
            />
          </div>
          <div className="text-xs text-gray-500">
            Automatically convert to NGN when balance exceeds this amount
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
              isSubmitting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg hover:shadow-xl"
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center space-x-2">
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {balance.auto_convert_threshold
                    ? "Update Threshold"
                    : "Enable Auto-Convert"}
                </span>
              </div>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// Conversion Item Component
const ConversionItem = ({
  from,
  to,
  amount,
  value,
  time,
  status,
}: {
  from: string;
  to: string;
  amount: string;
  value: string;
  time: string;
  status: string;
}) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-300">
    <div className="flex items-center space-x-4">
      <div className="p-2 bg-blue-100 rounded-lg">
        <ArrowRightLeft className="w-4 h-4 text-blue-600" />
      </div>
      <div>
        <div className="font-semibold text-gray-900">
          {from} → {to}
        </div>
        <div className="text-sm text-gray-600">{amount}</div>
      </div>
    </div>
    <div className="text-right">
      <div className="font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{time}</div>
    </div>
  </div>
);

export default MultiCurrencyView;
