import React from "react";
import { Bell, User, ChevronDown, Menu } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

interface HeaderProps {
  isAdmin?: boolean;
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isAdmin = false, onMenuClick }) => {
  const { user } = useAuth();
  return (
    <header className="z-[99] bg-white border-b border-gray-200 px-4 lg:px-6 py-4 fixed w-full lg:w-[calc(100%-280px)] h-[80px] lg:-ml-[0px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">
              {isAdmin ? "Admin Dashboard" : "Dashboard"}
            </h1>
            <p className="text-gray-600 text-sm lg:text-base hidden sm:block">
              {isAdmin
                ? "Manage users and monitor system activity"
                : `Welcome back, @${user?.tag}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 lg:space-x-4">
          <button
            type="button"
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
          </button>

          <div className="flex items-center space-x-1 lg:space-x-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-800 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="text-sm hidden sm:block">
              <div className="font-medium text-gray-900">
                {isAdmin ? "Admin" : `@${user?.tag}`}
              </div>
              {/* <div className="text-gray-500">
                {isAdmin
                  ? "System Administrator"
                  : user?.address.slice(0, 8) + "..."}
              </div> */}
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
