import React, { useEffect, useState, useMemo, useCallback } from "react";
import QRCode from "react-qr-code";
import { Copy, Download, Share2, CheckCircle } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { UserTokenBalance } from "../../interfaces";
import { apiClient } from "../../utils/api";

const QRCodeGenerator: React.FC = () => {
  const [copiedField, setCopiedField] = useState("");
  const [balances, setBalances] = useState<UserTokenBalance[]>([]);
  const [selectedToken, setSelectedToken] = useState<UserTokenBalance | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const userTag = user ? `@${user.tag}` : "";

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const data = await apiClient.get<UserTokenBalance[]>("/balances");
        setBalances(data);
      } catch (error) {
        console.error("Error fetching balances:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBalances();
  }, []);

  const depositData = useMemo(
    () =>
      JSON.stringify({
        tag: user?.tag,
        address: selectedToken?.address,
        token: selectedToken?.token_name,
        version: "1.0",
      }),
    [user?.tag, selectedToken]
  );

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 2000);
  }, []);

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

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Token Selection */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">
          Select Token
        </h4>
        {loading ? (
          <p className="text-center p-4">Loading balances...</p>
        ) : balances.length === 0 ? (
          <p className="text-center p-4 text-gray-500">No tokens available</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {balances.map((balance) => (
              <button
                type="button"
                key={balance.id}
                onClick={() => setSelectedToken(balance)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  selectedToken?.id === balance.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">
                  {balance.token_name}
                </div>
                <div className="text-sm text-gray-500">
                  {balance.token_symbol}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Section */}
      {selectedToken && (
        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Receive Crypto via QR Code
          </h3>

          <div className="bg-white p-6 rounded-xl border-2 border-gray-100 inline-block mb-6">
            <QRCode
              id="qr-code"
              value={depositData}
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            />
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-lg">
              <div className="text-sm text-blue-100 mb-1">Send crypto to:</div>
              <div className="text-2xl font-bold">{userTag}</div>
              <div className="text-sm font-medium">Wallet Address: {selectedToken?.address ?? "not set"}</div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => copyToClipboard(userTag, "tag")}
                className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                {copiedField === "tag" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">Copy Tag</span>
              </button>

              <button
                type="button"
                onClick={downloadQR}
                className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Save QR</span>
              </button>

              <button
                type="button"
                onClick={shareQR}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">How to Use</h4>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            • Share your QR code or tag with anyone who wants to send you crypto
          </p>
          <p>• They can scan the QR code with their wallet app</p>
          <p>
            • Or they can send directly to your tag:{" "}
            <span className="font-mono bg-white px-2 py-1 rounded text-blue-600">
              {userTag}
            </span>
          </p>
          <p>• Funds will appear in your balance once confirmed on-chain</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
