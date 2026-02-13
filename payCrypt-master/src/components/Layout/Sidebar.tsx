import React from "react";
import {
  Home,
  ArrowUpDown,
  ArrowRightLeft,
  Settings,
  BarChart3,
  QrCode,
  Users,
  DollarSign,
  Receipt,
  UserPlus,
  Coins,
  RefreshCcw,
  Send,
  PlusCircle,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import PayCryptLogo from "./Logo";

interface SidebarProps {
  isAdmin?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isAdmin = false,
  isOpen = false,
  onClose,
}) => {
  const userMenuItems = [
    { to: "/", label: "Dashboard", icon: Home, end: true },
    { to: "/balances", label: "Balances", icon: Coins },
    { to: "/deposits", label: "Deposits", icon: PlusCircle },
    // { to: "/qr-code", label: "QR Code", icon: QrCode },
    { to: "/withdraw", label: "Withdraw", icon: Send },
    { to: "/swap", label: "Swap", icon: RefreshCcw },
    { to: "/bills", label: "Pay Bills", icon: Receipt },
    { to: "/multi-currency", label: "Multi-Currency", icon: ArrowRightLeft },
    { to: "/split", label: "Split Payment", icon: UserPlus },
    { to: "/settings", label: "Settings", icon: Settings },
  ];

  const adminMenuItems = [
    { to: "/admin/overview", label: "Overview", icon: BarChart3 },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/payouts", label: "Payouts", icon: DollarSign },
    { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ];

  const menuItems = isAdmin ? adminMenuItems : userMenuItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-64 lg:w-[280px] bg-white border-r border-gray-200 min-h-screen h-full flex flex-col transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="p-6 flex items-center justify-between">
          <PayCryptLogo className="w-10 h-10" showText={true} />
          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <nav className="px-4 space-y-1 flex-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => onClose?.()}
                className={({ isActive }) =>
                  `w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-left transition-colors duration-200 ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 ${
                        isActive ? "text-blue-700" : "text-gray-400"
                      }`}
                    />
                    <span className="font-medium">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-100">
            <div className="text-sm font-medium text-gray-800">Need Help?</div>
            <div className="text-xs text-gray-600 mt-1">
              Contact our support team for assistance
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
