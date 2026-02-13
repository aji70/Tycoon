import React, { useState } from "react";
import {
  User,
  Shield,
  Bell,
  CreditCard,
  Key,
  LogOut,
  Settings as SettingsIcon,
  Mail,
  MapPin,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Smartphone,
  Zap,
  Globe,
  Palette,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import KYCForm from "../KYC/KYCForm";

const SettingsView: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");
  const [darkMode, setDarkMode] = useState(false);

  const tabs = [
    {
      id: "profile",
      label: "Profile",
      icon: User,
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "security",
      label: "Security",
      icon: Shield,
      color: "from-green-500 to-emerald-500",
    },
    {
      id: "kyc",
      label: "Verification",
      icon: CreditCard,
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: Bell,
      color: "from-orange-500 to-red-500",
    },
    {
      id: "preferences",
      label: "Preferences",
      icon: Palette,
      color: "from-indigo-500 to-blue-500",
    },
  ];

  const SecuritySettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-green-100 rounded-xl">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Security Settings
            </h3>
            <p className="text-gray-600 text-sm">
              Manage your account security preferences
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SecurityCard
            icon={<Key className="w-5 h-5" />}
            title="Two-Factor Authentication"
            description="Add an extra layer of security to your account"
            status="inactive"
            action="Enable"
            onClick={() => console.log("Enable 2FA")}
            gradient="from-blue-500 to-purple-500"
          />

          <SecurityCard
            icon={<Lock className="w-5 h-5" />}
            title="Change Password"
            description="Update your account password regularly"
            status="active"
            action="Change"
            onClick={() => console.log("Change password")}
            gradient="from-green-500 to-emerald-500"
          />

          <SecurityCard
            icon={<Smartphone className="w-5 h-5" />}
            title="Device Management"
            description="Manage devices connected to your account"
            status="active"
            action="Manage"
            onClick={() => console.log("Manage devices")}
            gradient="from-orange-500 to-red-500"
          />
        </div>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
        <div className="flex items-start space-x-3">
          <Zap className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-amber-900 mb-2">Security Tips</h4>
            <ul className="text-amber-800 text-sm space-y-1">
              <li>• Enable 2FA for enhanced security</li>
              <li>• Use a strong, unique password</li>
              <li>• Regularly review connected devices</li>
              <li>• Never share your credentials</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const ProfileSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-xl">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Profile Information
            </h3>
            <p className="text-gray-600 text-sm">
              Manage your personal account details
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InfoField
            icon={<User className="w-4 h-4" />}
            label="Username Tag"
            value={`@${user?.tag}`}
            gradient="from-blue-500 to-cyan-500"
          />

          <InfoField
            icon={<Mail className="w-4 h-4" />}
            label="Email Address"
            value={user?.email || ""}
            gradient="from-purple-500 to-pink-500"
          />

          {/* <div className="lg:col-span-2">
            <InfoField
              icon={<MapPin className="w-4 h-4" />}
              label="Wallet Address"
              value={user?.address || ""}
              gradient="from-green-500 to-emerald-500"
              isMonospace
            />
          </div> */}
        </div>
      </div>
    </div>
  );

  const NotificationSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-orange-100 rounded-xl">
            <Bell className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Notification Preferences
            </h3>
            <p className="text-gray-600 text-sm">
              Choose how you want to be notified
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            {
              label: "Transaction Notifications",
              description: "Get notified about deposits and withdrawals",
              enabled: true,
            },
            {
              label: "Security Alerts",
              description: "Important security-related notifications",
              enabled: true,
            },
            {
              label: "Price Alerts",
              description: "Crypto price movement notifications",
              enabled: false,
            },
            {
              label: "Marketing Updates",
              description: "Product updates and promotional offers",
              enabled: false,
            },
            {
              label: "Weekly Reports",
              description: "Weekly portfolio performance summary",
              enabled: true,
            },
          ].map((item, index) => (
            <ToggleCard
              key={index}
              label={item.label}
              description={item.description}
              enabled={item.enabled}
              onChange={(enabled) => console.log(`${item.label}: ${enabled}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const PreferenceSettings = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-indigo-100 rounded-xl">
            <Palette className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              App Preferences
            </h3>
            <p className="text-gray-600 text-sm">Customize your experience</p>
          </div>
        </div>

        <div className="space-y-6">
          <PreferenceToggle
            icon={
              darkMode ? (
                <Moon className="w-5 h-5" />
              ) : (
                <Sun className="w-5 h-5" />
              )
            }
            label="Dark Mode"
            description="Switch between light and dark themes"
            enabled={darkMode}
            onChange={setDarkMode}
          />

          <PreferenceToggle
            icon={<Globe className="w-5 h-5" />}
            label="Local Currency"
            description="Show amounts in your local currency"
            enabled={true}
            onChange={() => {}}
          />

          <PreferenceToggle
            icon={<Eye className="w-5 h-5" />}
            label="Balance Visibility"
            description="Show or hide your balances"
            enabled={true}
            onChange={() => {}}
          />
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSettings />;
      case "security":
        return <SecuritySettings />;
      case "kyc":
        return <KYCForm />;
      case "notifications":
        return <NotificationSettings />;
      case "preferences":
        return <PreferenceSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
            <SettingsIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Settings
            </h1>
            <p className="text-gray-600">Manage your account and preferences</p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center space-x-2 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Enhanced Sidebar */}
        <div className="xl:w-80">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    @{user?.tag}
                  </div>
                  <div className="text-sm text-gray-500">{user?.email}</div>
                </div>
              </div>
            </div>

            <nav className="p-4 space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left transition-all duration-300 ${
                      isActive
                        ? `bg-gradient-to-r ${tab.color} text-white shadow-lg transform -translate-y-0.5`
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-md"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                    {isActive && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-sm">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

// Reusable Components
const SecurityCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "active" | "inactive";
  action: string;
  onClick: () => void;
  gradient: string;
}> = ({ icon, title, description, status, action, onClick, gradient }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-300">
    <div className="flex items-center space-x-4">
      <div className={`p-2 bg-gradient-to-r ${gradient} rounded-lg text-white`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
    </div>
    <div className="flex items-center space-x-3">
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {status === "active" ? "Active" : "Inactive"}
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
          status === "active"
            ? "bg-gray-600 hover:bg-gray-700 text-white"
            : "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl"
        }`}
      >
        {action}
      </button>
    </div>
  </div>
);

const InfoField: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  gradient: string;
  isMonospace?: boolean;
}> = ({ icon, label, value, gradient, isMonospace = false }) => (
  <div className="space-y-2">
    <label
      htmlFor="d"
      className="flex items-center space-x-2 text-sm font-semibold text-gray-700"
    >
      <div
        className={`p-1.5 bg-gradient-to-r ${gradient} rounded-lg text-white`}
      >
        {icon}
      </div>
      <span>{label}</span>
    </label>
    <div
      className={`p-3 bg-gray-50 rounded-xl border border-gray-200 ${
        isMonospace ? "font-mono text-sm" : "text-gray-900"
      }`}
    >
      {value}
    </div>
  </div>
);

const StatCard: React.FC<{
  label: string;
  value: string;
  status?: "verified" | "active" | "inactive";
}> = ({ label, value, status }) => (
  <div className="text-center p-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300">
    <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
    <div className="text-sm text-gray-600">{label}</div>
    {status && (
      <div
        className={`mt-2 text-xs px-2 py-1 rounded-full ${
          status === "verified"
            ? "bg-green-100 text-green-700"
            : status === "active"
            ? "bg-blue-100 text-blue-700"
            : "bg-gray-100 text-gray-600"
        }`}
      >
        {status}
      </div>
    )}
  </div>
);

const ToggleCard: React.FC<{
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-300">
    <div className="flex-1">
      <div className="font-semibold text-gray-900">{label}</div>
      <div className="text-sm text-gray-600">{description}</div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-purple-500" />
    </label>
  </div>
);

const PreferenceToggle: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ icon, label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all duration-300">
    <div className="flex items-center space-x-4">
      <div className="p-2 bg-gray-100 rounded-lg text-gray-600">{icon}</div>
      <div>
        <div className="font-semibold text-gray-900">{label}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={enabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-500 peer-checked:to-purple-500" />
    </label>
  </div>
);

export default SettingsView;
