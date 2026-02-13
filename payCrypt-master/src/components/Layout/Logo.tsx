import React from 'react';

const PayCryptLogo: React.FC<{ className?: string; showText?: boolean }> = ({ 
  className = "w-8 h-8", 
  showText = true 
}) => {
  return (
    <div className="flex items-center space-x-2">
      <div className={`relative ${className}`}>
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Outer ring - represents security/blockchain */}
          <circle
            cx="20"
            cy="20"
            r="18"
            stroke="url(#gradient1)"
            strokeWidth="2"
            fill="none"
            className="animate-pulse"
          />
          
          {/* Inner hexagon - represents crypto/blockchain structure */}
          <path
            d="M20 6L30 12V28L20 34L10 28V12L20 6Z"
            fill="url(#gradient2)"
            stroke="url(#gradient1)"
            strokeWidth="1"
          />
          
          {/* Central P symbol */}
          <path
            d="M16 14H22C24 14 25 15 25 17C25 19 24 20 22 20H16V26M16 14V20M16 20H22"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          
          {/* Crypto dots - representing digital currency */}
          <circle cx="28" cy="12" r="2" fill="url(#gradient3)" className="animate-bounce" style={{ animationDelay: '0s' }} />
          <circle cx="32" cy="20" r="1.5" fill="url(#gradient3)" className="animate-bounce" style={{ animationDelay: '0.2s' }} />
          <circle cx="28" cy="28" r="1.5" fill="url(#gradient3)" className="animate-bounce" style={{ animationDelay: '0.4s' }} />
          
          {/* Gradients */}
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E40AF" />
              <stop offset="50%" stopColor="#7C3AED" />
              <stop offset="100%" stopColor="#0891B2" />
            </linearGradient>
            <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      {showText && (
        <div className="flex flex-col">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
            TaggedPay
          </span>
          <span className="text-xs text-gray-500 -mt-1">Smart Payments</span>
        </div>
      )}
    </div>
  );
};

export default PayCryptLogo;