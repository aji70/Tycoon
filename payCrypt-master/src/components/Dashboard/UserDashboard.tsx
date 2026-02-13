import React, { useEffect, useState, useMemo } from "react";
import {
  Wallet,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Send,
  Eye,
  EyeOff,
  Plus,
  QrCode,
  RefreshCcw,
  Receipt,
} from "lucide-react";
import TransactionTable from "./TransactionTable";
import { apiClient } from "../../utils/api";
import {
  formatCrypto,
  formatCurrency,
  formatCurrencyToNGN,
} from "../../utils/amount";
import { useAuth } from "../../contexts/AuthContext";
import { NavLink } from "react-router-dom";
import {
  DashboardSummary,
  UserTokenBalance,
  UserTransaction,
} from "../../interfaces";

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [userTransactions, setUserTransactions] = useState<UserTransaction[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [balancesRes, summaryRes, transactionsRes] = await Promise.all([
          apiClient.get<UserTokenBalance[]>("/balances"),
          apiClient.get<DashboardSummary>("/users/dashboard-summary"),
          apiClient.get<UserTransaction[]>("/transactions"),
        ]);

        setBalances(balancesRes || []);
        setSummary(summaryRes || null);
        setUserTransactions(transactionsRes || []);
        // setWallet(walletRes || null);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const totalCryptoValue = balances.reduce(
    (sum, balance) => Number(sum) + Number(balance.usd_value),
    0
  );

  const totalNgnValue = balances.reduce(
    (sum, balance) => Number(sum) + Number(balance.ngn_value),
    0
  );
  // 🧮 Memoized computed values
  const stats = useMemo(
    () => [
      {
        title: "Available Balance",
        value: `${formatCurrencyToNGN(
          (totalNgnValue || summary?.total_balance) ?? 0
        )}`,
        icon: Wallet,
        color: "text-white",
        gradient: "from-purple-500 to-pink-500",
        subtitle: "NGN Wallet",
      },
      {
        title: "Total Portfolio",
        value: formatCurrency(summary?.total_balance ?? 0),
        icon: TrendingUp,
        color: "text-white",
        gradient: "from-blue-500 to-cyan-500",
        subtitle: "All Assets",
      },
      {
        title: "Total Deposits",
        value: formatCurrency(summary?.total_deposit ?? 0),
        icon: ArrowDownLeft,
        color: "text-white",
        gradient: "from-emerald-500 to-green-500",
        subtitle: "Lifetime",
      },
      {
        title: "Total Withdrawals",
        value: formatCurrency(summary?.total_withdrawal ?? 0),
        icon: ArrowUpRight,
        color: "text-white",
        gradient: "from-orange-500 to-red-500",
        subtitle: "Lifetime",
      },
    ],
    [summary, totalNgnValue]
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Main Wallet Card */}
      <div className="w-full flex flex-col space-y-4 space-x-0 items-start justify-start xl:items-stretch xl:flex-row xl:space-x-4 xl:space-y-0 xl:justify-between">
        <div className="w-full xl:w-1/2 bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl p-6 text-white shadow-2xl flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold opacity-90">
                  Total Balance
                </h2>
                <button
                  type="button"
                  onClick={() => setShowBalance(!showBalance)}
                  className="p-1 hover:bg-white/20 rounded-full transition-colors"
                >
                  {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <h1 className="text-2xl font-bold">
                {showBalance
                  ? formatCurrency(
                      totalCryptoValue ?? (summary?.total_balance || 0)
                    )
                  : "••••••"}
              </h1>
              <p className="text-sm opacity-80 mt-1">@{user?.tag}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <QrCode size={32} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="w-full flex justify-between items-center">
            <NavLink
              to="/deposits"
              className="flex flex-col items-center space-y-2 hover:scale-105 transition-transform"
            >
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <ArrowDownLeft size={20} />
              </div>
              <span className="text-xs font-medium">Receive</span>
            </NavLink>
            <NavLink
              to="/withdraw"
              className="flex flex-col items-center space-y-2 hover:scale-105 transition-transform"
            >
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <ArrowUpRight size={20} />
              </div>
              <span className="text-xs font-medium">Send</span>
            </NavLink>
            <NavLink
              to="/swap"
              className="flex flex-col items-center space-y-2 hover:scale-105 transition-transform"
            >
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <RefreshCcw size={20} />
              </div>
              <span className="text-xs font-medium">Swap</span>
            </NavLink>
            <button
              type="button"
              className="flex flex-col items-center space-y-2 hover:scale-105 transition-transform"
            >
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                <Plus size={20} />
              </div>
              <span className="text-xs font-medium">More</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="w-full xl:w-1/2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4">
          {stats.map(({ title, value, icon: Icon, gradient, subtitle }) => (
            <div
              key={title}
              className={`bg-gradient-to-br ${gradient} rounded-2xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
            >
              <div className="flex items-center justify-between mb-3">
                <Icon size={24} className="text-white/90" />
                <div className="text-xs font-medium bg-white/20 px-2 py-1 rounded-full">
                  {subtitle}
                </div>
              </div>
              <div className="text-sm font-medium opacity-90 mb-1">{title}</div>
              <div className="text-xl font-bold">{loading ? "--" : value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Balances Overview */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Your Assets</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage your cryptocurrency portfolio
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Coins size={24} className="text-purple-500" />
            <span className="text-sm font-medium text-gray-600">
              {balances.length} assets
            </span>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
            <div className="text-sm text-gray-600 mb-1">
              Total Portfolio Value
            </div>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(
                balances.reduce(
                  (sum, balance) => sum + Number(balance.usd_value),
                  0
                )
              )}
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
            <div className="text-sm text-gray-600 mb-1">Best Performer</div>
            <div className="text-lg font-semibold text-gray-900">
              {balances.length > 0
                ? balances.reduce((max, balance) =>
                    Number(balance.usd_value) > Number(max.usd_value)
                      ? balance
                      : max
                  ).token_symbol
                : "--"}
            </div>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-100">
            <div className="text-sm text-gray-600 mb-1">
              Assets with Balance
            </div>
            <div className="text-xl font-bold text-gray-900">
              {balances.filter((b) => Number(b.amount) > 0).length}
            </div>
          </div>
        </div>

        {/* Assets Grid */}
        <div className="space-y-3">
          {balances.map((balance, index) => {
            const hasBalance = Number(balance.amount) > 0;
            const usdValue = Number(balance.usd_value);
            const tokenPrice = Number(balance.token_price);

            return (
              <div
                key={balance.id}
                className="group p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-purple-300 transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Token Info */}
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={`/${balance.token_logo_url}`}
                        alt={balance.token_name}
                        className="w-12 h-12 rounded-full border-2 border-white shadow-sm"
                      />
                      {hasBalance && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors">
                          {balance.token_name}
                        </h4>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                          {balance.token_symbol}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <div className="text-sm text-gray-500">
                          Price: {formatCurrency(tokenPrice)}
                        </div>
                        {hasBalance ? (
                          <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            Active
                          </div>
                        ) : (
                          <div className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                            No Balance
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Balance Info */}
                  <div className="text-right">
                    <div className="mb-1">
                      <div className="text-lg font-bold text-gray-900">
                        {formatCrypto(
                          Number(balance.amount),
                          balance.token_symbol
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {balance.token_symbol}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(usdValue)}
                      </div>
                      <div className="text-xs text-gray-500">USD Value</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {hasBalance && (
                  <div className="flex items-center justify-end space-x-3 mt-4 pt-4 border-t border-gray-100">
                    <button
                      type="button"
                      className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-700 font-medium px-3 py-1 rounded-lg hover:bg-purple-50 transition-colors"
                    >
                      <Send size={14} />
                      <span>Send</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <ArrowDownLeft size={14} />
                      <span>Receive</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-700 font-medium px-3 py-1 rounded-lg hover:bg-green-50 transition-colors"
                    >
                      <RefreshCcw size={14} />
                      <span>Swap</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {balances.filter((b) => Number(b.amount) > 0).length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins size={32} className="text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              No assets with balance
            </h4>
            <p className="text-gray-500 mb-6">
              Start by depositing crypto to see your balances here
            </p>
            <div className="flex justify-center space-x-3">
              <NavLink
                to="/deposits"
                className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
              >
                Deposit
              </NavLink>
              <NavLink
                to="/swap"
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-300"
              >
                Swap
              </NavLink>
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl p-0 border border-gray-100 shadow-sm">
        <TransactionTable transactions={userTransactions.slice(0, 5)} />
      </div>

      {/* Additional Quick Actions */}
      <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-6 border border-indigo-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">
          Quick Access
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <NavLink
            to="/deposits"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-emerald-500 to-green-500 p-2 rounded-lg">
                <ArrowDownLeft className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-emerald-600">
                  Receive
                </div>
                <div className="text-sm text-gray-600">
                  Share your @{user?.tag}
                </div>
              </div>
            </div>
          </NavLink>
          <NavLink
            to="/withdraw"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-red-500 to-orange-500 p-2 rounded-lg">
                <Send className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-red-600">
                  Send
                </div>
                <div className="text-sm text-gray-600">To wallet or fiat</div>
              </div>
            </div>
          </NavLink>
          <NavLink
            to="/swap"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-2 rounded-lg">
                <RefreshCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-blue-600">
                  Swap
                </div>
                <div className="text-sm text-gray-600">Exchange assets</div>
              </div>
            </div>
          </NavLink>
          <NavLink
            to="/cards"
            className="bg-white p-5 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-2 rounded-lg">
                <Receipt className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-semibold text-gray-900 group-hover:text-purple-600">
                  Pay Bills
                </div>
                <div className="text-sm text-gray-600">Pay bills with ease</div>
              </div>
            </div>
          </NavLink>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
