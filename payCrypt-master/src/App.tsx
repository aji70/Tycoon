import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicRoute from "./components/PublicRoute";
import { useWebSocket } from "./hooks/useWebSocket";

// Layout
import Sidebar from "./components/Layout/Sidebar";
import Header from "./components/Layout/Header";

// Public pages
import AuthPage from "./components/Auth/AuthPage";

// User pages
import UserDashboard from "./components/Dashboard/UserDashboard";
import BalancesView from "./components/Balances/BalancesView";
import DepositsView from "./components/Deposits/DepositsView";
import QRCodeGenerator from "./components/QRCode/QRCodeGenerator";
import WithdrawView from "./components/Withdraw/WithdrawView";
import SwapView from "./components/Swap/SwapView";
import BillsView from "./components/Bills/BillsView";
import SplitPaymentView from "./components/Split/SplitPaymentView";
import MultiCurrencyView from "./components/MultiCurrency/MultiCurrencyView";
import SettingsView from "./components/Settings/SettingsView";

// Admin pages
import AdminDashboard from "./components/Admin/AdminDashboard";
import AdminUsers from "./components/Admin/AdminUsers";
import AdminPayouts from "./components/Admin/AdminPayouts";
import KYCForm from "./components/KYC/KYCForm";
import ApiTest from "./components/Test/ApiTest";
import { useIntervalApi } from "./hooks/useIntervalApi";

// Private app layout with auth guard
const PrivateLayout: React.FC = () => {
  const { user, isLoading } = useAuth();
  const { isConnected } = useWebSocket("ws://localhost:3001", user?.id);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  useIntervalApi("/wallets/balance", 120000);
  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        isAdmin={isAdmin}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden lg:ml-[280px]">
        <Header isAdmin={isAdmin} onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto mt-[80px] z-0">
          {isConnected && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 lg:px-6 py-2">
              <div className="flex items-center space-x-2 text-sm text-emerald-700">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span>Live updates connected</span>
              </div>
            </div>
          )}
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

// Guard for admin-only sections
const AdminGuard: React.FC = () => {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public route */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <AuthPage />
          </PublicRoute>
        }
      />

      {/* Private routes */}
      <Route element={<PrivateLayout />}>
        {/* Default dashboard */}
        <Route
          index
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        {/* User routes */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="balances"
          element={
            <ProtectedRoute requireKyc={true}>
              <BalancesView />
            </ProtectedRoute>
          }
        />
        <Route
          path="multi-currency"
          element={
            <ProtectedRoute requireKyc={true}>
              <MultiCurrencyView />
            </ProtectedRoute>
          }
        />
        <Route
          path="deposits"
          element={
            <ProtectedRoute requireKyc={true}>
              <DepositsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="qr-code"
          element={
            <ProtectedRoute requireKyc={true}>
              <QRCodeGenerator />
            </ProtectedRoute>
          }
        />
        <Route
          path="withdraw"
          element={
            <ProtectedRoute requireKyc={true}>
              <WithdrawView />
            </ProtectedRoute>
          }
        />
        <Route
          path="swap"
          element={
            <ProtectedRoute requireKyc={true}>
              <SwapView />
            </ProtectedRoute>
          }
        />
        <Route
          path="bills"
          element={
            <ProtectedRoute requireKyc={true}>
              <BillsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="split"
          element={
            <ProtectedRoute requireKyc={true}>
              <SplitPaymentView />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute>
              <SettingsView />
            </ProtectedRoute>
          }
        />
        <Route
          path="kyc"
          element={
            <ProtectedRoute>
              <KYCForm />
            </ProtectedRoute>
          }
        />
        <Route path="test/api" element={<ApiTest />} />

        {/* Admin-only routes */}
        <Route path="admin" element={<AdminGuard />}>
          <Route path="overview" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route
            path="analytics"
            element={
              <div className="text-center py-12 text-gray-500">
                Admin Analytics Panel - Coming Soon
              </div>
            }
          />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
