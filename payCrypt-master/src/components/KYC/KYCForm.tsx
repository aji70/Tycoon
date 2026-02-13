import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  Camera,
  Shield,
  User,
  Phone,
  Building,
  CreditCard,
  Fingerprint,
  Lock,
  Sparkles,
  X,
  BadgeCheck,
  FileCheck,
  Home,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { KYCData } from "../../types";
import { apiClient } from "../../utils/api";

// Cloudinary configuration
const CLOUDINARY_UPLOAD_PRESET = "default";
const CLOUDINARY_CLOUD_NAME = "dfvxv2mpj";

interface KYCFormData
  extends Omit<KYCData, "id_document_url" | "proof_of_address_url"> {
  id_document_url?: string;
  proof_of_address_url?: string;
}

const KYCForm: React.FC = () => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File }>(
    {}
  );
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: boolean;
  }>({});
  const [showModal, setShowModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<KYCFormData>();

  // Watch for uploaded file URLs
  const idDocumentUrl = watch("id_document_url");
  const proofOfAddressUrl = watch("proof_of_address_url");
  const fullName = watch("full_name");
  const phoneNumber = watch("phone_number");
  const bankName = watch("bank_name");
  const accountNumber = watch("account_number");

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "kyc_documents");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error("Failed to upload image to Cloudinary");
    }

    const data = await response.json();
    return data.secure_url;
  };

  useEffect(() => {
    if (user?.kyc_status !== "verified") {
      setShowModal(true);
    }
  }, [user]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    fieldName: string
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      alert("Please upload only JPEG, PNG, or PDF files");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5MB");
      return;
    }

    setUploadedFiles((prev) => ({ ...prev, [fieldName]: file }));
    setUploadingFiles((prev) => ({ ...prev, [fieldName]: true }));

    try {
      const secureUrl = await uploadToCloudinary(file);

      if (fieldName === "id_document") {
        setValue("id_document_url", secureUrl);
      } else if (fieldName === "proof_of_address") {
        setValue("proof_of_address_url", secureUrl);
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file. Please try again.");
      setUploadedFiles((prev) => {
        const newFiles = { ...prev };
        delete newFiles[fieldName];
        return newFiles;
      });
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [fieldName]: false }));
    }
  };

  const onSubmit = async (data: KYCFormData) => {
    if (!data.id_document_url || !data.proof_of_address_url) {
      alert("Please upload all required documents");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/kycs", {
        full_name: data.full_name,
        phone_number: data.phone_number,
        bank_name: data.bank_name,
        account_number: data.account_number,
        bvn: data.bvn || null,
        id_document: data.id_document_url,
        proof_of_address: data.proof_of_address_url,
      });
      alert(
        "KYC information submitted successfully! We will review your documents within 24-48 hours."
      );
      window.location.reload();
    } catch (error) {
      console.error("KYC submission failed:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to submit KYC information. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1) {
      const isValid = await trigger([
        "full_name",
        "phone_number",
        "bank_name",
        "account_number",
      ]);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await trigger([
        "id_document_url",
        "proof_of_address_url",
      ]);
      if (isValid) setCurrentStep(3);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
  };

  // 🔹 Enhanced Modal Component
  const Modal = () => (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl shadow-2xl p-8 max-w-md w-full border border-gray-200/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Shield className="w-6 h-6 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              Verification Required
            </h2>
          </div>
          <button
            onClick={() => setShowModal(false)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-xl">
            <Lock className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-700 font-medium">
              Secure & Encrypted
            </span>
          </div>

          <p className="text-gray-700 leading-relaxed">
            Complete{" "}
            <strong className="text-blue-600">basic KYC verification</strong> to
            unlock full platform access including:
          </p>

          <div className="space-y-2">
            {[
              "Deposits & Withdrawals",
              "Crypto Swaps",
              "Wallet Purchases",
              "Higher Limits",
            ].map((feature, index) => (
              <div key={index} className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={() => setShowModal(false)}
            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
          >
            Start Verification
          </button>
        </div>
      </div>
    </div>
  );

  // 🔹 Step Progress Component
  const StepProgress = () => (
    <div className="flex items-center justify-between mb-8">
      {[1, 2, 3].map((step) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                step === currentStep
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                  : step < currentStep
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step < currentStep ? (
                <CheckCircle className="w-6 h-6" />
              ) : (
                <span className="font-semibold">{step}</span>
              )}
            </div>
            <span
              className={`text-xs mt-2 font-medium ${
                step === currentStep ? "text-blue-600" : "text-gray-500"
              }`}
            >
              {step === 1
                ? "Personal Info"
                : step === 2
                ? "Documents"
                : "Review"}
            </span>
          </div>
          {step < 3 && (
            <div
              className={`flex-1 h-1 mx-4 ${
                step < currentStep ? "bg-green-500" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  if (user?.kyc_status === "verified") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-emerald-500 to-green-500 rounded-3xl p-8 text-white text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <BadgeCheck className="w-12 h-12" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Identity Verified</h3>
          <p className="text-emerald-100 opacity-90">
            Your account has been successfully verified and all features are now
            unlocked
          </p>
        </div>
      </div>
    );
  }

  if (user?.kyc_status === "pending") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-3xl p-8 text-white text-center shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <FileCheck className="w-12 h-12" />
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Verification in Progress</h3>
          <p className="text-amber-100 opacity-90">
            We're reviewing your documents. This usually takes 24-48 hours.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {showModal && <Modal />}
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Identity Verification
          </h1>
          <p className="text-gray-600">
            Secure your account and unlock full platform access
          </p>
        </div>

        {/* Main Form Container */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border border-gray-200/50 shadow-xl overflow-hidden">
          {/* Progress Bar */}
          <div className="bg-white border-b border-gray-200 p-6">
            <StepProgress />
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      icon={<User className="w-5 h-5" />}
                      label="Full Name"
                      name="full_name"
                      register={register}
                      error={errors.full_name}
                      placeholder="Enter your full legal name"
                      required
                      gradient="from-blue-500 to-cyan-500"
                    />

                    <FormField
                      icon={<Phone className="w-5 h-5" />}
                      label="Phone Number"
                      name="phone_number"
                      register={register}
                      error={errors.phone_number}
                      placeholder="+234 or 0"
                      type="tel"
                      required
                      gradient="from-green-500 to-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      icon={<Building className="w-5 h-5" />}
                      label="Bank Name"
                      name="bank_name"
                      register={register}
                      error={errors.bank_name}
                      type="select"
                      required
                      gradient="from-purple-500 to-pink-500"
                    >
                      <option value="">Select your bank</option>
                      <option value="gtbank">GTBank</option>
                      <option value="access">Access Bank</option>
                      <option value="zenith">Zenith Bank</option>
                      <option value="first">First Bank</option>
                      <option value="uba">UBA</option>
                      <option value="fidelity">Fidelity Bank</option>
                      <option value="union">Union Bank</option>
                      <option value="sterling">Sterling Bank</option>
                    </FormField>

                    <FormField
                      icon={<CreditCard className="w-5 h-5" />}
                      label="Account Number"
                      name="account_number"
                      register={register}
                      error={errors.account_number}
                      placeholder="10-digit account number"
                      required
                      gradient="from-orange-500 to-red-500"
                    />
                  </div>

                  <FormField
                    icon={<Fingerprint className="w-5 h-5" />}
                    label="BVN (Optional)"
                    name="bvn"
                    register={register}
                    error={errors.bvn}
                    placeholder="11-digit BVN"
                    gradient="from-indigo-500 to-blue-500"
                  />
                </div>
              )}

              {/* Step 2: Document Upload */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DocumentUpload
                      label="ID Document"
                      description="NIN, Driver's License, or Passport"
                      fieldName="id_document"
                      isUploading={uploadingFiles.id_document}
                      isUploaded={!!idDocumentUrl}
                      fileName={uploadedFiles.id_document?.name}
                      onFileUpload={handleFileUpload}
                      icon={<FileText className="w-6 h-6" />}
                      gradient="from-blue-500 to-purple-500"
                      error={!idDocumentUrl}
                    />

                    <DocumentUpload
                      label="Proof of Address"
                      description="Utility bill from last 3 months"
                      fieldName="proof_of_address"
                      isUploading={uploadingFiles.proof_of_address}
                      isUploaded={!!proofOfAddressUrl}
                      fileName={uploadedFiles.proof_of_address?.name}
                      onFileUpload={handleFileUpload}
                      icon={<Home className="w-6 h-6" />}
                      gradient="from-green-500 to-emerald-500"
                      error={!proofOfAddressUrl}
                    />
                  </div>

                  {/* Requirements */}
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-amber-100 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-amber-900 mb-3">
                          Document Requirements
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-amber-800">
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>Clear and readable documents</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>Government-issued ID</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>Recent utility bill (3 months)</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>Max 5MB per file</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>JPEG, PNG, or PDF formats</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-amber-500 rounded-full"></div>
                            <span>24-48 hour processing</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Submit */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <Sparkles className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Review Your Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InfoRow label="Full Name" value={fullName} />
                      <InfoRow label="Phone Number" value={phoneNumber} />
                      <InfoRow label="Bank Name" value={bankName} />
                      <InfoRow label="Account Number" value={accountNumber} />
                      <InfoRow
                        label="ID Document"
                        value={uploadedFiles.id_document?.name || "Uploaded"}
                        status="verified"
                      />
                      <InfoRow
                        label="Proof of Address"
                        value={
                          uploadedFiles.proof_of_address?.name || "Uploaded"
                        }
                        status="verified"
                      />
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-200">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-6 h-6 text-green-600" />
                      <div>
                        <h4 className="font-semibold text-green-900">
                          Your Data is Secure
                        </h4>
                        <p className="text-green-700 text-sm">
                          All information is encrypted and protected
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-8 border-t border-gray-200">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-8 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-300"
                  >
                    Back
                  </button>
                ) : (
                  <div></div>
                )}

                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
                  >
                    <span>Continue</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Submit Verification</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

// 🔹 Reusable Form Field Component
const FormField: React.FC<any> = ({
  icon,
  label,
  name,
  register,
  error,
  placeholder,
  type = "text",
  required = false,
  gradient,
  children,
  ...props
}) => (
  <div className="space-y-2">
    <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
      <div
        className={`p-1.5 bg-gradient-to-r ${gradient} rounded-lg text-white`}
      >
        {icon}
      </div>
      <span>
        {label} {required && <span className="text-red-500">*</span>}
      </span>
    </label>

    {type === "select" ? (
      <select
        {...register(name, { required: required && `${label} is required` })}
        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white"
        {...props}
      >
        {children}
      </select>
    ) : (
      <input
        type={type}
        {...register(name, { required: required && `${label} is required` })}
        placeholder={placeholder}
        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
        {...props}
      />
    )}

    {error && (
      <p className="text-red-600 text-sm flex items-center space-x-1">
        <AlertCircle className="w-4 h-4" />
        <span>{error.message}</span>
      </p>
    )}
  </div>
);

// 🔹 Document Upload Component
const DocumentUpload: React.FC<any> = ({
  label,
  description,
  fieldName,
  isUploading,
  isUploaded,
  fileName,
  onFileUpload,
  icon,
  gradient,
  error,
}) => (
  <div className="space-y-3">
    <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700">
      <div
        className={`p-1.5 bg-gradient-to-r ${gradient} rounded-lg text-white`}
      >
        {icon}
      </div>
      <span>{label}</span>
    </label>

    <div
      className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all duration-300 ${
        error
          ? "border-red-300 bg-red-50"
          : "border-gray-300 hover:border-gray-400 bg-white"
      }`}
    >
      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => onFileUpload(e, fieldName)}
        className="hidden"
        id={fieldName}
        disabled={isUploading}
      />
      <label htmlFor={fieldName} className="cursor-pointer block">
        {isUploading ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-blue-600 font-medium">Uploading...</p>
          </div>
        ) : isUploaded ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-green-600 font-medium">
              {fileName || "Document Uploaded"}
            </p>
            <p className="text-green-500 text-sm mt-1">Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div
              className={`p-3 bg-gradient-to-r ${gradient} rounded-2xl mb-3`}
            >
              <Upload className="w-6 h-6 text-white" />
            </div>
            <p className="text-gray-600 font-medium">Click to upload {label}</p>
            <p className="text-gray-500 text-sm mt-1">{description}</p>
          </div>
        )}
      </label>
    </div>

    {error && (
      <p className="text-red-600 text-sm flex items-center space-x-1">
        <AlertCircle className="w-4 h-4" />
        <span>{label} is required</span>
      </p>
    )}
  </div>
);

// 🔹 Info Row Component for Review Step
const InfoRow: React.FC<{
  label: string;
  value: string;
  status?: "verified";
}> = ({ label, value, status }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-gray-600 font-medium">{label}</span>
    <div className="flex items-center space-x-2">
      <span className="text-gray-900 font-semibold">{value}</span>
      {status === "verified" && (
        <CheckCircle className="w-4 h-4 text-green-500" />
      )}
    </div>
  </div>
);

export default KYCForm;
