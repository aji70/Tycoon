import React, { useState } from 'react';
import { Shield, Zap, Globe } from 'lucide-react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PayCryptLogo from '../Layout/Logo';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col lg:flex-row">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-purple-700 p-8 xl:p-12 flex-col justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-8">
            <PayCryptLogo className="w-12 h-12" showText={false} />
            <span className="text-3xl font-bold text-white">TaggedPay</span>
          </div>
          
          <h1 className="text-3xl xl:text-4xl font-bold text-white mb-6 leading-tight">
            The Future of<br />
            Crypto Payments
          </h1>
          
          <p className="text-lg xl:text-xl text-blue-100 mb-8 xl:mb-12 leading-relaxed">
            Send and receive crypto using simple tags. Convert to NGN instantly.
            Your gateway to seamless digital payments.
          </p>

          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Bank-Grade Security</h3>
                <p className="text-blue-100 text-sm">Your funds are protected with enterprise-level security</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Instant Transfers</h3>
                <p className="text-blue-100 text-sm">Send crypto as easily as sending a text message</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Multi-Chain Support</h3>
                <p className="text-blue-100 text-sm">Works with Ethereum, Starknet, Base, and Core networks</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-purple-400/20 rounded-full blur-xl"></div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  );
};

export default AuthPage;