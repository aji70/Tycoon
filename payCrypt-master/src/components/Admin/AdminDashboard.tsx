import React from 'react';
import { Users, DollarSign, TrendingUp, Activity } from 'lucide-react';
import StatsCard from '../Dashboard/StatsCard';
import TransactionTable from '../Dashboard/TransactionTable';
import { mockTransactions, formatCurrency } from '../../utils/mockData';

const AdminDashboard: React.FC = () => {
  const totalUsers = 15432;
  const totalVolume = 2450000;
  const totalFees = 24500;
  const activeUsers = 8920;

  // Extended mock data for admin view
  const adminTransactions = [
    ...mockTransactions,
    {
      id: '4',
      type: 'deposit' as const,
      tag: 'john_doe',
      token: 'USDC',
      amount: 1000,
      usd_value: 1000,
      status: 'completed' as const,
      tx_hash: '0x456...def',
      chain: 'ethereum',
      timestamp: '2024-01-20T11:30:00Z',
      from_address: '0x123...abc'
    },
    {
      id: '5',
      type: 'withdrawal' as const,
      tag: 'alice_crypto',
      token: 'ETH',
      amount: 0.8,
      usd_value: 1960,
      status: 'pending' as const,
      chain: 'ethereum',
      timestamp: '2024-01-20T10:15:00Z',
      to_address: '0x789...ghi'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Admin Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={totalUsers.toLocaleString()}
          change="+5.2% from last month"
          changeType="positive"
          icon={Users}
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Total Volume"
          value={formatCurrency(totalVolume)}
          change="+18.3% from last month"
          changeType="positive"
          icon={DollarSign}
          iconColor="text-emerald-600"
        />
        <StatsCard
          title="Platform Fees"
          value={formatCurrency(totalFees)}
          change="+12.1% from last month"
          changeType="positive"
          icon={TrendingUp}
          iconColor="text-purple-600"
        />
        <StatsCard
          title="Active Users (30d)"
          value={activeUsers.toLocaleString()}
          change="+8.7% from last month"
          changeType="positive"
          icon={Activity}
          iconColor="text-amber-600"
        />
      </div>

      {/* System Health */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 mb-1">99.9%</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">145ms</div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">12.5K</div>
            <div className="text-sm text-gray-600">Transactions Today</div>
          </div>
        </div>
      </div>

      {/* Chain Status */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Blockchain Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: 'Ethereum', status: 'healthy', blockHeight: '18,500,234' },
            { name: 'Starknet', status: 'healthy', blockHeight: '445,123' },
            { name: 'Base', status: 'healthy', blockHeight: '8,234,567' },
            { name: 'Core', status: 'syncing', blockHeight: '2,345,678' }
          ].map(chain => (
            <div key={chain.name} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{chain.name}</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  chain.status === 'healthy' 
                    ? 'text-emerald-600 bg-emerald-50' 
                    : 'text-amber-600 bg-amber-50'
                }`}>
                  {chain.status}
                </span>
              </div>
              <div className="text-sm text-gray-600">Block: {chain.blockHeight}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Transactions */}
      <TransactionTable transactions={adminTransactions} showUserColumn={true} />

      {/* Top Users */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users by Volume</h3>
        <div className="space-y-4">
          {[
            { tag: 'crypto_whale', volume: 145000, transactions: 23 },
            { tag: 'trader_pro', volume: 98000, transactions: 45 },
            { tag: 'defi_master', volume: 76000, transactions: 18 },
            { tag: 'hodl_king', volume: 65000, transactions: 12 },
            { tag: 'yield_farmer', volume: 54000, transactions: 34 }
          ].map((user, index) => (
            <div key={user.tag} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium text-blue-600">@{user.tag}</div>
                  <div className="text-sm text-gray-500">{user.transactions} transactions</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{formatCurrency(user.volume)}</div>
                <div className="text-sm text-gray-500">30d volume</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;