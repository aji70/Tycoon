import React, { useEffect, useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  TrendingUp,
  PieChart,
  Coins,
  Wallet,
  Filter,
} from "lucide-react";
import { formatCurrency } from "../../utils/amount";
import { DashboardSummary, UserTokenBalance } from "../../interfaces";
import { apiClient } from "../../utils/api";

const BalancesView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [hideBalances, setHideBalances] = useState(false);
  const [selectedChain, setSelectedChain] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [summaryRes, balancesRes] = await Promise.all([
          apiClient.get<DashboardSummary>("/users/dashboard-summary"),
          apiClient.get<UserTokenBalance[]>("/balances"),
        ]);

        setSummary(summaryRes || null);
        setBalances(balancesRes || []);
      } catch (error) {
        console.error("Error fetching balances data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 🧮 Derived values
  const chains = useMemo(
    () => ["all", ...new Set(balances.map((b) => b.token_name))],
    [balances]
  );

  const filteredBalances = useMemo(
    () =>
      selectedChain === "all"
        ? balances
        : balances.filter((b) => b.token_name === selectedChain),
    [balances, selectedChain]
  );

  const totalPortfolioValue = useMemo(
    () => balances.reduce((sum, balance) => sum + Number(balance.usd_value), 0),
    [balances]
  );

  // 🔒 Utility for hiding balances
  const masked = (value: string | number, mask = "••••••") =>
    hideBalances ? mask : value;

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Portfolio Overview */}
      <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -translate-x-24 translate-y-24" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Portfolio Value</h3>
                <p className="text-blue-100 text-sm">
                  Total assets across all chains
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setHideBalances((prev) => !prev)}
              className="p-3 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-sm transition-all duration-300"
            >
              {hideBalances ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between">
            <div className="mb-6 lg:mb-0">
              <div className="text-4xl lg:text-5xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                {masked(formatCurrency(totalPortfolioValue))}
              </div>
              <div className="flex items-center space-x-2 text-blue-100">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">All-time portfolio performance</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                label="Total Deposited"
                value={masked(
                  formatCurrency(summary?.total_deposit || 0),
                  "••••••"
                )}
                color="from-green-400 to-emerald-500"
              />
              <StatCard
                label="Total Withdrawn"
                value={masked(
                  formatCurrency(summary?.total_withdrawal || 0),
                  "••••••"
                )}
                color="from-orange-400 to-red-500"
              />
              <div className="hidden lg:block">
                <StatCard
                  label="Active Assets"
                  value={balances.length.toString()}
                  color="from-purple-400 to-pink-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chain Filter */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filter Assets</h3>
          </div>
          <span className="text-sm text-gray-500">
            {filteredBalances.length} of {balances.length} assets
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {chains.map((chain) => (
            <ChainFilterButton
              key={chain}
              chain={chain}
              isActive={selectedChain === chain}
              onClick={() => setSelectedChain(chain)}
            />
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Balances */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Coins className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Your Assets
                </h3>
              </div>
              <div className="text-sm text-gray-500">Sorted by value</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBalances.map((balance) => (
                <AssetCard
                  key={balance.id}
                  balance={balance}
                  hideBalances={hideBalances}
                  portfolioValue={totalPortfolioValue}
                />
              ))}
            </div>

            {filteredBalances.length === 0 && (
              <div className="text-center py-12">
                <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No assets found for this filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm sticky top-6">
            <div className="flex items-center space-x-2 mb-6">
              <PieChart className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                Asset Allocation
              </h3>
            </div>

            <div className="space-y-4">
              {filteredBalances.map((balance) => {
                const percentage =
                  totalPortfolioValue > 0
                    ? (Number(balance.usd_value) / totalPortfolioValue) * 100
                    : 0;

                return (
                  <AllocationItem
                    key={balance.id}
                    balance={balance}
                    percentage={percentage}
                    hideBalances={hideBalances}
                  />
                );
              })}
            </div>

            {filteredBalances.length === 0 && (
              <div className="text-center py-8">
                <PieChart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No allocation data</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6 max-w-6xl mx-auto animate-pulse">
    <div className="bg-gray-300 rounded-3xl h-48" />
    <div className="bg-gray-200 rounded-2xl h-20" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-gray-200 rounded-2xl h-96" />
      <div className="lg:col-span-1 bg-gray-200 rounded-2xl h-96" />
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

// Chain Filter Button Component
const ChainFilterButton: React.FC<{
  chain: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ chain, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
      isActive
        ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md"
    }`}
  >
    {chain === "all" ? "All Chains" : chain}
  </button>
);

// Asset Card Component
const AssetCard: React.FC<{
  balance: UserTokenBalance;
  hideBalances: boolean;
  portfolioValue: number;
}> = ({ balance, hideBalances, portfolioValue }) => {
  const percentage =
    portfolioValue > 0 ? (Number(balance.usd_value) / portfolioValue) * 100 : 0;

  return (
    <div className="group p-5 bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 hover:border-purple-300 transition-all duration-300 hover:shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <img
            src={`/${balance.token_logo_url}`}
            alt={balance.token_name}
            className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
          />
          <div>
            <div className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
              {balance.token_symbol}
            </div>
            <div className="text-sm text-gray-500 capitalize">
              {balance.token_name}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">
            {percentage.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-2xl font-bold text-gray-900">
            {hideBalances
              ? "••••••"
              : Number(balance.amount).toLocaleString(undefined, {
                  maximumFractionDigits: 6,
                })}
          </div>
          <div className="text-sm text-gray-500">{balance.token_symbol}</div>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <div className="text-lg font-semibold text-gray-700">
              {hideBalances
                ? "••••••"
                : formatCurrency(Number(balance.usd_value))}
            </div>
            <div className="text-xs text-gray-500">USD Value</div>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium text-gray-600">
              {hideBalances ? "••••" : formatCurrency(balance.token_price || 0)}
            </div>
            <div className="text-xs text-gray-500">Price</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Allocation Item Component
const AllocationItem: React.FC<{
  balance: UserTokenBalance;
  percentage: number;
  hideBalances: boolean;
}> = ({ balance, percentage, hideBalances }) => (
  <div className="group p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center space-x-3">
        <img
          src={balance.token_logo_url}
          alt={balance.token_name}
          className="w-8 h-8 rounded-full border border-white shadow-sm"
          onError={(e) => {
            e.currentTarget.src = `https://cryptologos.cc/logos/default-logo.png`;
          }}
        />
        <span className="font-medium text-gray-900 text-sm">
          {balance.token_symbol}
        </span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-gray-900">
          {percentage.toFixed(1)}%
        </div>
      </div>
    </div>

    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
      <div
        className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>

    <div className="flex justify-between text-xs text-gray-500">
      <span>Allocation</span>
      <span>
        {hideBalances ? "••••••" : formatCurrency(Number(balance.usd_value))}
      </span>
    </div>
  </div>
);

export default BalancesView;
