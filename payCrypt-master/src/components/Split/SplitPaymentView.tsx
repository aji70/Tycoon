import React, { useState } from "react";
import {
  Plus,
  Minus,
  Users,
  DollarSign,
  Send,
  Share2,
  PieChart,
  Target,
  Sparkles,
  CheckCircle2,
  Zap,
  Calculator,
  UserPlus,
  ArrowRightLeft,
  Shield,
  Clock,
} from "lucide-react";
import { formatCurrency } from "../../utils/mockData";

interface Recipient {
  id: string;
  tag: string;
  percentage: number;
  amount: number;
}

const SplitPaymentView: React.FC = () => {
  const [totalAmount, setTotalAmount] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: "1", tag: "", percentage: 50, amount: 0 },
    { id: "2", tag: "", percentage: 50, amount: 0 },
  ]);
  const [splitType, setSplitType] = useState<"equal" | "percentage" | "custom">(
    "equal"
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const updateAmounts = (newRecipients: Recipient[], amount: string) => {
    const total = parseFloat(amount) || 0;

    if (splitType === "equal") {
      const equalAmount = total / newRecipients.length;
      return newRecipients.map((r) => ({
        ...r,
        amount: equalAmount,
        percentage: 100 / newRecipients.length,
      }));
    } else if (splitType === "percentage") {
      return newRecipients.map((r) => ({
        ...r,
        amount: (total * r.percentage) / 100,
      }));
    }

    return newRecipients;
  };

  const handleAmountChange = (amount: string) => {
    setTotalAmount(amount);
    setRecipients((prev) => updateAmounts(prev, amount));
    if (amount && parseFloat(amount) > 0) {
      setActiveStep(2);
    }
  };

  const addRecipient = () => {
    const newRecipient: Recipient = {
      id: Date.now().toString(),
      tag: "",
      percentage: 0,
      amount: 0,
    };
    const newRecipients = [...recipients, newRecipient];
    setRecipients(updateAmounts(newRecipients, totalAmount));
  };

  const removeRecipient = (id: string) => {
    if (recipients.length > 2) {
      const newRecipients = recipients.filter((r) => r.id !== id);
      setRecipients(updateAmounts(newRecipients, totalAmount));
    }
  };

  const updateRecipient = (
    id: string,
    field: keyof Recipient,
    value: string | number
  ) => {
    const newRecipients = recipients.map((r) =>
      r.id === id ? { ...r, [field]: value } : r
    );
    setRecipients(updateAmounts(newRecipients, totalAmount));
  };

  const handleSplitTypeChange = (type: "equal" | "percentage" | "custom") => {
    setSplitType(type);
    setRecipients((prev) => updateAmounts(prev, totalAmount));
    setActiveStep(3);
  };

  const handleSendPayment = () => {
    setIsProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      alert("Split payment sent successfully!");
    }, 2000);
  };

  const totalPercentage = recipients.reduce((sum, r) => sum + r.percentage, 0);
  const totalCalculated = recipients.reduce((sum, r) => sum + r.amount, 0);
  const isValid =
    recipients.every((r) => r.tag.trim() !== "") &&
    totalAmount &&
    parseFloat(totalAmount) > 0 &&
    (splitType !== "percentage" || Math.abs(totalPercentage - 100) < 0.01);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Enhanced Header */}
      <div className="text-center mb-2">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl shadow-2xl">
            <Share2 className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
          Split Payments
        </h1>
        <p className="text-gray-600 text-lg">
          Send money to multiple people with one transaction
        </p>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    step === activeStep
                      ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-110"
                      : step < activeStep
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step < activeStep ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <span className="font-semibold">{step}</span>
                  )}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    step === activeStep ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  {step === 1 && "Amount"}
                  {step === 2 && "Method"}
                  {step === 3 && "Recipients"}
                  {step === 4 && "Review"}
                </span>
              </div>
              {step < 4 && (
                <div
                  className={`flex-1 h-1 mx-4 ${
                    step < activeStep ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Total Amount Section */}
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-xl">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Total Amount
              </h3>
              <p className="text-gray-600 text-sm">
                Enter the total amount to split
              </p>
            </div>
          </div>

          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-6 h-6 text-blue-500" />
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full pl-12 pr-4 py-4 border-2 border-blue-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-2xl font-bold bg-white transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Split Method Section */}
      {activeStep >= 2 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-purple-100 rounded-xl">
              <PieChart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Split Method
              </h3>
              <p className="text-gray-600 text-sm">
                Choose how to distribute the amount
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                type: "equal" as const,
                label: "Equal Split",
                desc: "Divide equally among all recipients",
                icon: <Calculator className="w-6 h-6" />,
                gradient: "from-blue-500 to-cyan-500",
              },
              {
                type: "percentage" as const,
                label: "Percentage",
                desc: "Set custom percentages",
                icon: <Target className="w-6 h-6" />,
                gradient: "from-green-500 to-emerald-500",
              },
              {
                type: "custom" as const,
                label: "Custom Amount",
                desc: "Set specific amounts",
                icon: <Zap className="w-6 h-6" />,
                gradient: "from-purple-500 to-pink-500",
              },
            ].map((option) => (
              <button
                key={option.type}
                onClick={() => handleSplitTypeChange(option.type)}
                className={`p-6 rounded-2xl border-2 transition-all duration-300 text-left group ${
                  splitType === option.type
                    ? `border-transparent bg-gradient-to-r ${option.gradient} text-white shadow-2xl transform -translate-y-1`
                    : "border-gray-200 hover:border-gray-300 hover:shadow-lg"
                }`}
              >
                <div
                  className={`p-3 rounded-xl w-12 h-12 flex items-center justify-center mb-4 ${
                    splitType === option.type
                      ? "bg-white/20"
                      : `bg-gradient-to-r ${option.gradient}`
                  }`}
                >
                  {option.icon}
                </div>
                <div className="font-bold text-lg mb-2">{option.label}</div>
                <div
                  className={`text-sm ${
                    splitType === option.type
                      ? "text-white/90"
                      : "text-gray-600"
                  }`}
                >
                  {option.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recipients Section */}
      {activeStep >= 3 && (
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-xl">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Recipients
                </h3>
                <p className="text-gray-600 text-sm">
                  Add people to split the payment with
                </p>
              </div>
            </div>
            <button
              onClick={addRecipient}
              className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-4 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Recipient</span>
            </button>
          </div>

          <div className="space-y-4">
            {recipients.map((recipient, index) => (
              <div
                key={recipient.id}
                className="p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 hover:border-gray-300 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        Recipient {index + 1}
                      </div>
                      <div className="text-sm text-gray-500">
                        Enter their TaggedPay tag
                      </div>
                    </div>
                  </div>
                  {recipients.length > 2 && (
                    <button
                      onClick={() => removeRecipient(recipient.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors duration-300"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                      <Users className="w-4 h-4 text-blue-500" />
                      <span>TaggedPay Tag</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                        @
                      </div>
                      <input
                        type="text"
                        value={recipient.tag}
                        onChange={(e) =>
                          updateRecipient(recipient.id, "tag", e.target.value)
                        }
                        placeholder="username"
                        className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                      />
                    </div>
                  </div>

                  {splitType === "percentage" && (
                    <div>
                      <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                        <Target className="w-4 h-4 text-green-500" />
                        <span>Percentage</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={recipient.percentage}
                          onChange={(e) =>
                            updateRecipient(
                              recipient.id,
                              "percentage",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          placeholder="0"
                          min="0"
                          max="100"
                          className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
                        />
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                          %
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-2">
                      <DollarSign className="w-4 h-4 text-purple-500" />
                      <span>Amount</span>
                    </label>
                    <div className="p-3 bg-white border-2 border-gray-200 rounded-xl text-lg font-bold text-gray-900">
                      {formatCurrency(recipient.amount)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Summary */}
          <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div className="text-sm font-semibold text-green-700">
                    Payment Summary
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(totalCalculated)}
                </div>
                <div className="text-sm text-green-700">
                  Total to be distributed
                </div>
              </div>

              {splitType === "percentage" && (
                <div className="mt-4 lg:mt-0 text-center lg:text-right">
                  <div className="text-sm font-semibold text-green-700 mb-1">
                    Total Percentage
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      Math.abs(totalPercentage - 100) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {totalPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-green-700">
                    {Math.abs(totalPercentage - 100) < 0.01
                      ? "Perfect split!"
                      : "Adjust percentages"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">
            Secure & Instant
          </div>
          <div className="text-sm text-gray-600">
            Encrypted and fast transfers
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ArrowRightLeft className="w-6 h-6 text-green-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">
            Multiple Methods
          </div>
          <div className="text-sm text-gray-600">
            Equal, percentage, or custom splits
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-purple-600" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Save Time</div>
          <div className="text-sm text-gray-600">
            One transaction, multiple recipients
          </div>
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSendPayment}
        disabled={!isValid || isProcessing}
        className={`w-full py-4 px-6 rounded-2xl font-semibold transition-all duration-300 ${
          isValid && !isProcessing
            ? "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-2xl hover:shadow-3xl transform hover:-translate-y-1"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-lg">Sending Payments...</span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2">
            <Sparkles className="w-6 h-6" />
            <span className="text-lg">Send Split Payment</span>
          </div>
        )}
      </button>
    </div>
  );
};

export default SplitPaymentView;
