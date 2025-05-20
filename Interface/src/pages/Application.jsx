import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import axios from 'axios';

const Application = () => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [userName, setUserName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { address: walletAddress, connected } = useWallet();

  const handleRegister = async () => {
    if (!userName.trim()) {
      setError("Please enter a valid name");
      return;
    }

    if (!connected || !walletAddress) {
      setError("Please connect your wallet first");
      return;
    }

    try {
      // Send both name and wallet address to your backend
      const response = await axios.post('/api/users', {
        name: userName.trim(),
        wallet_address: walletAddress
      });

      // Store user info in localStorage
      localStorage.setItem('userName', response.data.name);
      localStorage.setItem('walletAddress', response.data.wallet_address);
      localStorage.setItem('userId', response.data.id);

      setIsRegistered(true);
      
      setTimeout(() => {
        setIsModalOpen(false);
        navigate('/Main');
      }, 1500);
    } catch (error) {
      console.error('Registration failed:', error);
      setError(error.response?.data?.error?.message || 'Registration failed');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRegister();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="pt-40">
      </div>
      
      {/* Registration Modal */}
      {isModalOpen && (
        <div className="<fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-8 transform transition-all duration-300">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black mb-2">Get Started</h2>
              <p className="text-gray-600 font-medium">
                Enter your name to join the SuPay
              </p>
            </div>

            {!isRegistered ? (
              <div className="space-y-6">
                <div>
                  <label htmlFor="userName" className="block text-sm font-bold mb-2 text-gray-700">
                    Your Name
                  </label>
                  <input
                    id="userName"
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border-3 border-black font-medium text-lg focus:outline-none focus:border-blue-600 transition-colors duration-200"
                  />
                </div>
                <div className="text-sm text-gray-600">
      {connected ? (
        <div className="p-2 bg-green-100 rounded">
          Connected wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </div>
      ) : (
        <div className="p-2 bg-red-100 rounded">
          <ConnectButton className="w-full" />
        </div>
      )}
    </div>

    {error && <div className="text-red-500 text-sm">{error}</div>}
    <button
      onClick={handleRegister}
      disabled={!userName.trim() || !connected}
      className="w-full bg-blue-600 text-white font-black text-lg py-3 px-6 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ..."
    >
      Register Now →
    </button>
  </div>
            ) : (
              <div className="text-center space-y-3 sm:space-y-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900">
                  Welcome, {userName}!
                </h3>
                <p className="text-gray-600 font-medium text-sm sm:text-base">
                  You're all set to explore Sui Network
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Application;