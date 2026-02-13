import React, { useState } from 'react';
import { Search, Filter, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { FiatPayout } from '../../types';
import { formatCurrency } from '../../utils/mockData';

const AdminPayouts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Mock payouts data
  const mockPayouts: FiatPayout[] = [
    {
      id: '1',
      tag: 'llins',
      amount: 150000,
      currency: 'NGN',
      provider: 'paystack',
      status: 'pending',
      bankAccount: '0123456789 - GTBank',
      timestamp: '2024-01-20T14:30:00Z',
      requiresApproval: true,
      kycVerified: true
    },
    {
      id: '2',
      tag: 'crypto_whale',
      amount: 75000,
      currency: 'NGN',
      provider: 'monnify',
      status: 'completed',
      bankAccount: '9876543210 - Access Bank',
      timestamp: '2024-01-20T12:15:00Z',
      requiresApproval: false,
      kycVerified: true,
      approvedBy: 'admin_user'
    },
    {
      id: '3',
      tag: 'trader_pro',
      amount: 250000,
      currency: 'NGN',
      provider: 'paystack',
      status: 'processing',
      bankAccount: '1122334455 - Zenith Bank',
      timestamp: '2024-01-20T10:45:00Z',
      requiresApproval: true,
      kycVerified: true,
      approvedBy: 'admin_user'
    },
    {
      id: '4',
      tag: 'new_user',
      amount: 25000,
      currency: 'NGN',
      provider: 'paystack',
      status: 'failed',
      bankAccount: '5566778899 - First Bank',
      timestamp: '2024-01-20T09:30:00Z',
      requiresApproval: false,
      kycVerified: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600 bg-emerald-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'pending':
        return 'text-amber-600 bg-amber-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Clock className="w-4 h-4" />;
      case 'pending':
        return <AlertTriangle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const handleApprove = (payoutId: string) => {
    console.log('Approving payout:', payoutId);
    // In a real app, this would make an API call
    alert('Payout approved successfully!');
  };

  const handleReject = (payoutId: string) => {
    console.log('Rejecting payout:', payoutId);
    // In a real app, this would make an API call
    alert('Payout rejected.');
  };

  const filteredPayouts = mockPayouts.filter(payout => {
    const matchesSearch = payout.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         payout.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || payout.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalPending = mockPayouts.filter(p => p.status === 'pending').length;
  const totalAmount = mockPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">NGN Payouts</h2>
          <p className="text-gray-600">Manage fiat withdrawal requests</p>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
            {totalPending} Pending Approval
          </div>
          <div className="text-gray-500">
            Total: {formatCurrency(totalAmount, 'NGN')}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by tag or payout ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payout ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayouts.map((payout) => (
                <tr key={payout.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">#{payout.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xs">
                          {payout.tag.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-blue-600">@{payout.tag}</div>
                        <div className="flex items-center space-x-1 text-xs">
                          {payout.kycVerified ? (
                            <span className="text-emerald-600">KYC ✓</span>
                          ) : (
                            <span className="text-red-600">No KYC</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatCurrency(payout.amount, 'NGN')}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">{payout.provider}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{payout.bankAccount}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(payout.status)}`}>
                      {getStatusIcon(payout.status)}
                      <span className="capitalize">{payout.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(payout.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payout.status === 'pending' && payout.requiresApproval && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleApprove(payout.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(payout.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {payout.approvedBy && (
                      <div className="text-xs text-gray-500">
                        Approved by {payout.approvedBy}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">
            {mockPayouts.filter(p => p.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending Approval</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">
            {mockPayouts.filter(p => p.status === 'processing').length}
          </div>
          <div className="text-sm text-gray-600">Processing</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-2xl font-bold text-emerald-600">
            {mockPayouts.filter(p => p.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-2xl font-bold text-red-600">
            {mockPayouts.filter(p => p.status === 'failed').length}
          </div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>
    </div>
  );
};

export default AdminPayouts;