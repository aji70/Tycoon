import React, { useEffect, useState, useCallback } from "react";
import QRCode from "react-qr-code";
import {
  Copy,
  Download,
  Share2,
  CheckCircle,
  AlertCircle,
  QrCode,
  User,
  Sparkles,
  AtSign,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { UserTokenBalance } from "../../interfaces";
import { apiClient } from "../../utils/api";

const DepositsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [selectedToken, setSelectedToken] = useState<UserTokenBalance | null>(
    null
  );
  const [copiedField, setCopiedField] = useState("");
  const [activeTab, setActiveTab] = useState<"tag" | "qr">("tag");
  const { user } = useAuth();

  const userTag = `@${user?.tag}`;

  // Fetch balances on component mount
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const data = await apiClient.get<UserTokenBalance[]>("/balances");
        setBalances(data);
        // Auto-select first token with address for QR code
        const tokenWithAddress = data.find((balance) => balance.address);
        if (tokenWithAddress) {
          setSelectedToken(tokenWithAddress);
        }
      } catch (error) {
        console.error("Error fetching balances:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
  }, []);

  // Copy to clipboard function
  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  }, []);

  // Download QR code as PNG
  const downloadQR = useCallback(() => {
    const svg = document.getElementById("qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `paycrypt-${user?.tag}-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  }, [user?.tag]);

  // Share functionality
  const shareQR = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Send me crypto!",
          text: `Send crypto to my TaggedPay tag: ${userTag}`,
          url: window.location.origin,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      copyToClipboard(`Send crypto to my TaggedPay tag: ${userTag}`, "share");
    }
  }, [userTag, copyToClipboard]);

  // QR code data
  const depositData = JSON.stringify({
    tag: user?.tag,
    address: selectedToken?.address,
    token: selectedToken?.token_name,
    version: "1.0",
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Enhanced Header Tabs */}
      <div className="bg-gradient-to-r from-white to-gray-50 rounded-2xl p-2 border border-gray-200/50 shadow-sm">
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab("tag")}
            className={`flex-1 flex items-center justify-center space-x-2 p-2 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === "tag"
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/80"
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                activeTab === "tag" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              <AtSign size={16} />
            </div>
            <span className="text-sm sm:text-lg">Receive by Tag</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`flex-1 flex items-center justify-center space-x-2 p-2 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === "qr"
                ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25"
                : "text-gray-500 hover:text-gray-700 hover:bg-white/80"
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                activeTab === "qr" ? "bg-white/20" : "bg-gray-100"
              }`}
            >
              <QrCode size={16} />
            </div>
            <span className="text-sm sm:text-lg">Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {activeTab === "tag" ? (
        <TagDepositView
          userTag={userTag}
          copiedField={copiedField}
          copyToClipboard={copyToClipboard}
          shareQR={shareQR}
        />
      ) : (
        <QRDepositView
          loading={loading}
          balances={balances}
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          userTag={userTag}
          depositData={depositData}
          copiedField={copiedField}
          copyToClipboard={copyToClipboard}
          downloadQR={downloadQR}
          shareQR={shareQR}
        />
      )}

      {/* Enhanced Security Notice */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200/60">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900 mb-2">
              Security First
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-amber-800">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                <span>Only accept from trusted sources</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                <span>Verify network compatibility</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                <span>Contact support if issues arise</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-amber-400 rounded-full" />
                <span>Large deposits may need verification</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced Tag Deposit View Component
const TagDepositView: React.FC<{
  userTag: string;
  copiedField: string;
  copyToClipboard: (text: string, field: string) => void;
  shareQR: () => void;
}> = ({ userTag, copiedField, copyToClipboard, shareQR }) => (
  <div className="space-y-6">
    {/* Premium Tag Card */}
    <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 rounded-3xl p-8 text-white shadow-sm">
      <div className="absolute top-4 right-4">
        <Sparkles className="w-6 h-6 text-yellow-300" />
      </div>

      <div className="text-center mb-8">
        <div className="text-sm font-medium text-blue-100 mb-3">
          Your TaggedPay Tag
        </div>
        <div className="text-4xl font-bold font-mono bg-white/10 rounded-2xl py-4 px-6 inline-block">
          {userTag}
        </div>
        <div className="text-blue-100 mt-3 text-sm">
          Share this tag to receive any supported cryptocurrency
        </div>
      </div>

      <div className="flex justify-center space-x-4">
        <ActionButton
          onClick={() => copyToClipboard(userTag, "tag")}
          active={copiedField === "tag"}
          icon={
            copiedField === "tag" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Copy className="w-5 h-5" />
            )
          }
          label={copiedField === "tag" ? "Copied!" : "Copy Tag"}
          variant="light"
        />
        <ActionButton
          onClick={shareQR}
          icon={<Share2 className="w-5 h-5" />}
          label="Share"
          variant="light"
        />
      </div>
    </div>

    {/* Quick Tips */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
        <div className="text-green-600 text-sm font-semibold mb-2">
          Universal
        </div>
        <div className="text-gray-700 text-sm">
          Works with all supported cryptocurrencies
        </div>
      </div>
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-5 border border-blue-200">
        <div className="text-blue-600 text-sm font-semibold mb-2">Instant</div>
        <div className="text-gray-700 text-sm">
          Funds appear after blockchain confirmation
        </div>
      </div>
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-200">
        <div className="text-purple-600 text-sm font-semibold mb-2">Simple</div>
        <div className="text-gray-700 text-sm">
          Just share your tag - no addresses needed
        </div>
      </div>
    </div>
  </div>
);

// Enhanced QR Code Deposit View Component
const QRDepositView: React.FC<{
  loading: boolean;
  balances: UserTokenBalance[];
  selectedToken: UserTokenBalance | null;
  setSelectedToken: (token: UserTokenBalance) => void;
  userTag: string;
  depositData: string;
  copiedField: string;
  copyToClipboard: (text: string, field: string) => void;
  downloadQR: () => void;
  shareQR: () => void;
}> = ({
  loading,
  balances,
  selectedToken,
  setSelectedToken,
  userTag,
  depositData,
  copiedField,
  copyToClipboard,
  downloadQR,
  shareQR,
}) => (
  <div className="space-y-6">
    {/* Enhanced Token Selection */}
    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <span>Select Token</span>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
          {balances.filter((b) => b.address).length} available
        </span>
      </h4>

      {loading ? (
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
          <div className="text-gray-500 mt-2">Loading tokens...</div>
        </div>
      ) : balances.length === 0 ? (
        <div className="text-center p-8 text-gray-500">No tokens available</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {balances.map((balance) => (
            <TokenCard
              key={balance.id}
              balance={balance}
              isSelected={selectedToken?.id === balance.id}
              onClick={() => setSelectedToken(balance)}
            />
          ))}
        </div>
      )}
    </div>

    {/* Enhanced QR Code Section */}
    {selectedToken?.address && (
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-8 border border-gray-200/50 shadow-lg">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* QR Code with Enhanced Design */}
          <div className="flex-1">
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-lg">
              <div className="text-center mb-4">
                <div className="font-semibold text-gray-900">
                  {selectedToken.token_name}
                </div>
                <div className="text-sm text-gray-500">
                  Scan to send {selectedToken.token_symbol}
                </div>
              </div>

              <div className="flex items-center justify-center w-full bg-white">
                <div className="max-w-60 p-4 rounded-xl border border-gray-200">
                  <QRCode
                    id="qr-code"
                    value={depositData}
                    size={200}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Deposit Information */}
          <div className="flex-1 space-y-6">
            <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center space-x-3 mb-4">
                <div>
                  <div className="text-sm text-purple-100">
                    Send {selectedToken.token_symbol} to
                  </div>
                  <div className="text-2xl font-bold">{userTag}</div>
                </div>
              </div>

              {selectedToken.address && (
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="text-xs text-purple-100 mb-1">
                    Wallet Address
                  </div>
                  <div className="text-sm font-mono break-all bg-white/5 rounded px-2 py-1">
                    {selectedToken.address}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ActionButton
                onClick={() => copyToClipboard(userTag, "tag")}
                active={copiedField === "tag"}
                icon={
                  copiedField === "tag" ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )
                }
                label={copiedField === "tag" ? "Copied!" : "Copy Tag"}
                fullWidth
              />
              <ActionButton
                onClick={downloadQR}
                icon={<Download className="w-4 h-4" />}
                label="Save QR"
                fullWidth
              />
              <ActionButton
                onClick={shareQR}
                icon={<Share2 className="w-4 h-4" />}
                label="Share"
                fullWidth
                primary
              />
            </div>
          </div>
        </div>
      </div>
    )}

    {/* No Address Warning */}
    {selectedToken && !selectedToken.address && (
      <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-2xl p-6 border border-rose-200 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h4 className="text-lg font-semibold text-rose-800 mb-2">
          Address Not Configured
        </h4>
        <p className="text-rose-700">
          {selectedToken.token_name} wallet address is not set up yet.
        </p>
      </div>
    )}
  </div>
);

// Enhanced Token Card Component
const TokenCard: React.FC<{
  balance: UserTokenBalance;
  isSelected: boolean;
  onClick: () => void;
}> = ({ balance, isSelected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-4 rounded-xl border-2 transition-all duration-300 text-left group ${
      isSelected
        ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20 scale-105"
        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-md"
    } ${!balance.address ? "opacity-50" : ""}`}
  >
    <div className="flex items-center space-x-3">
      <div className="flex-1">
        <div className="font-semibold text-gray-900 text-left">
          {balance.token_name}
        </div>
        <div className="text-sm text-gray-500 mt-1">{balance.token_symbol}</div>
      </div>
    </div>
    {!balance.address && (
      <div className="text-xs text-amber-600 mt-2 text-left">
        Address not set
      </div>
    )}
  </button>
);

// Enhanced Reusable Components
const InfoCard: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
  bg: string;
  border: string;
}> = ({ icon, children, bg, border }) => (
  <div className={`${bg} rounded-2xl p-6 border ${border} backdrop-blur-sm`}>
    <div className="flex items-start space-x-4">
      <div className="p-3 bg-white/60 rounded-xl">{icon}</div>
      <div className="flex-1">{children}</div>
    </div>
  </div>
);

const ActionButton: React.FC<{
  onClick?: () => void;
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  fullWidth?: boolean;
  primary?: boolean;
  variant?: "default" | "light";
}> = ({
  onClick,
  active,
  icon,
  label,
  fullWidth = false,
  primary = false,
  variant = "default",
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-medium transition-all duration-300 ${
      fullWidth ? "w-full" : ""
    } ${
      variant === "light"
        ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
        : primary
        ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        : active
        ? "bg-gray-200 text-gray-800"
        : "bg-white text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 shadow-sm hover:shadow-md"
    }`}
  >
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </button>
);

export default DepositsView;
