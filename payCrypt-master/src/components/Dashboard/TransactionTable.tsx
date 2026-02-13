import React from "react";
import {
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  ExternalLink,
} from "lucide-react";
import { Transaction } from "../../types";
import {
  getTransactionStatusColor,
  formatCurrency,
  formatCrypto,
} from "../../utils/mockData";
import { UserTransaction } from "../../interfaces";

interface TransactionTableProps {
  transactions: UserTransaction[];
  showUserColumn?: boolean;
}

const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  showUserColumn = false,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownLeft className="w-4 h-4 text-emerald-600" />;
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-red-600" />;
      case "swap":
        return <ArrowRightLeft className="w-4 h-4 text-blue-600" />;
      default:
        return <ArrowRightLeft className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Recent Transactions
        </h3>
      </div>

      {/* Mobile Card Layout */}
      <div className="block lg:hidden">
        <div className="divide-y divide-gray-200">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  {getTypeIcon(tx.type)}
                  <span className="text-sm font-medium text-gray-900">
                    {getTypeLabel(tx.type)}
                  </span>
                </div>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTransactionStatusColor(
                    tx.status
                  )}`}
                >
                  {tx.status}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Amount:</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCrypto(Number(tx.amount), tx.token_symbol)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(Number(tx.usd_value))}
                    </div>
                  </div>
                </div>

                {showUserColumn && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">User:</span>
                    <span className="text-sm text-blue-600 font-medium">
                      @{tx.user_tag}
                    </span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Sender:</span>
                  <span className="text-sm text-gray-900 capitalize">
                    {tx.from_address}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Recipient:</span>
                  <span className="text-sm text-gray-900 capitalize">
                    {tx.to_address}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Date:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {new Date(tx.timestamp).toLocaleDateString()}
                    </span>
                    {tx.tx_hash && (
                      <a
                        href={`https://sepolia.voyager.online/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              {showUserColumn && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sender
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recipient
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    {getTypeIcon(tx.type)}
                    <span className="text-sm font-medium text-gray-900">
                      {getTypeLabel(tx.type)}
                    </span>
                  </div>
                </td>
                {showUserColumn && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-blue-600 font-medium">
                      @{tx.user_tag}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {formatCrypto(Number(tx.amount), tx.token_symbol)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(Number(tx.usd_value))}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 capitalize">
                    {tx.from_address}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900 capitalize">
                    {tx.to_address}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTransactionStatusColor(
                      tx.status
                    )}`}
                  >
                    {tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(tx.timestamp).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {tx.tx_hash && (
                    <a
                      href={`https://sepolia.voyager.online/tx/${tx.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionTable;
