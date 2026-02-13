import React, { useState } from "react";
import {
  Zap,
  Wifi,
  Phone,
  Tv,
  Trophy,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Play,
  TrendingUp,
  Shield,
} from "lucide-react";
import { formatCurrency } from "../../utils/mockData";

const BillsView: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState("electricity");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<
    "success" | "failed" | null
  >(null);

  const billCategories = [
    {
      id: "electricity",
      name: "Electricity",
      icon: Zap,
      color: "from-yellow-500 to-amber-500",
      bgColor: "from-yellow-50 to-amber-50",
    },
    {
      id: "internet",
      name: "Internet",
      icon: Wifi,
      color: "from-blue-500 to-cyan-500",
      bgColor: "from-blue-50 to-cyan-50",
    },
    {
      id: "airtime",
      name: "Airtime",
      icon: Phone,
      color: "from-green-500 to-emerald-500",
      bgColor: "from-green-50 to-emerald-50",
    },
    {
      id: "cable",
      name: "Cable TV",
      icon: Tv,
      color: "from-purple-500 to-pink-500",
      bgColor: "from-purple-50 to-pink-50",
    },
    {
      id: "betting",
      name: "Betting",
      icon: Trophy,
      color: "from-red-500 to-orange-500",
      bgColor: "from-red-50 to-orange-50",
    },
  ];

  const providers = {
    electricity: ["AEDC", "EKEDC", "IKEDC", "PHED", "KEDCO"],
    internet: ["MTN", "Airtel", "Glo", "9mobile", "Spectranet"],
    airtime: ["MTN", "Airtel", "Glo", "9mobile"],
    cable: ["DSTV", "GOTV", "Startimes", "Showmax"],
    betting: ["Bet9ja", "Nairabet", "SportyBet", "BetKing", "1xBet"],
  };

  const getInputLabel = () => {
    switch (selectedCategory) {
      case "electricity":
        return "Meter Number";
      case "airtime":
        return "Phone Number";
      case "cable":
        return "Smart Card Number";
      case "betting":
        return "Account ID";
      default:
        return "Account Number";
    }
  };

  const getInputPlaceholder = () => {
    switch (selectedCategory) {
      case "electricity":
        return "Enter meter number";
      case "airtime":
        return "Enter phone number";
      case "cable":
        return "Enter smart card number";
      case "betting":
        return "Enter account ID";
      default:
        return "Enter account number";
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    setPaymentResult(null);

    // Simulate payment processing
    setTimeout(() => {
      const success = Math.random() > 0.2;
      setPaymentResult(success ? "success" : "failed");
      setIsProcessing(false);

      if (success) {
        setTimeout(() => {
          setAccountNumber("");
          setAmount("");
          setPaymentResult(null);
        }, 3000);
      }
    }, 3000);
  };

  const isValidPayment =
    selectedProvider && accountNumber && amount && parseFloat(amount) > 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-2">
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
          Bill Payments
        </h1>
        <p className="text-gray-600">
          Pay your bills instantly with crypto or NGN
        </p>
      </div>

      {/* Payment Result Modal */}
      {paymentResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl max-w-md w-full p-8 text-center border border-gray-200 shadow-2xl">
            {paymentResult === "success" ? (
              <>
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Payment Successful!
                </h3>
                <p className="text-gray-600 mb-6">
                  Your {selectedCategory} bill has been paid successfully.
                </p>
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 mb-6 border border-green-200">
                  <div className="text-sm text-green-600 mb-1">
                    Transaction ID
                  </div>
                  <div className="font-mono text-sm font-semibold text-green-800">
                    #TXN{Date.now()}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Payment Failed
                </h3>
                <p className="text-gray-600 mb-6">
                  Unable to process your payment. Please try again.
                </p>
              </>
            )}
            <button
              onClick={() => setPaymentResult(null)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {paymentResult === "success" ? "Done" : "Try Again"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Selection */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span>Bill Category</span>
            </h3>
            <div className="space-y-3">
              {billCategories.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setSelectedProvider("");
                      setAccountNumber("");
                    }}
                    className={`w-full flex items-center space-x-4 p-4 rounded-xl border-2 transition-all duration-300 ${
                      isActive
                        ? `border-transparent bg-gradient-to-r ${category.color} text-white shadow-lg transform -translate-y-0.5`
                        : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        isActive
                          ? "bg-white/20"
                          : `bg-gradient-to-r ${category.bgColor}`
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 ${
                          isActive
                            ? "text-white"
                            : category.color
                                .replace("from-", "text-")
                                .split(" ")[0]
                        }`}
                      />
                    </div>
                    <span className="font-semibold">{category.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Payment Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Selection */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Service Provider
            </h3>
            <div className="relative">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white transition-all duration-300"
              >
                <option value="">Select a provider</option>
                {providers[selectedCategory as keyof typeof providers]?.map(
                  (provider) => (
                    <option key={provider} value={provider}>
                      {provider}
                    </option>
                  )
                )}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Bill Details */}
          <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Payment Details
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {getInputLabel()}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={getInputPlaceholder()}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount (NGN)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                />
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          {isValidPayment && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Payment Summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-blue-100">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-semibold text-gray-900">
                    {selectedProvider} {selectedCategory}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-blue-100">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(parseFloat(amount), "NGN")}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-blue-100">
                  <span className="text-gray-600">Service Fee:</span>
                  <span className="font-semibold text-gray-900">₦50.00</span>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between text-base font-bold text-gray-900">
                    <span>Total:</span>
                    <span>
                      {formatCurrency(parseFloat(amount) + 50, "NGN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={!isValidPayment || isProcessing}
            className={`w-full py-4 px-6 rounded-xl font-semibold transition-all duration-300 ${
              isValidPayment && !isProcessing
                ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Processing Payment...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center space-x-2">
                <Play className="w-5 h-5" />
                <span>Pay Now</span>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Instant</div>
          <div className="text-sm text-gray-600">Real-time payments</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Secure</div>
          <div className="text-sm text-gray-600">Encrypted transactions</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Reliable</div>
          <div className="text-sm text-gray-600">99.9% success rate</div>
        </div>
      </div>
    </div>
  );
};

export default BillsView;
