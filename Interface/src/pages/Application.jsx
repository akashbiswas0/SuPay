import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectButton, useWallet } from '@suiet/wallet-kit';

const Application = () => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [userName, setUserName] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const navigate = useNavigate(); // Initialize navigate hook

  const handleRegister = () => {
    if (userName.trim()) {
      // Store user name in localStorage
      localStorage.setItem('userName', userName.trim());
      
      setIsRegistered(true);
      
      // Redirect to /main page after showing success message
      setTimeout(() => {
        setIsModalOpen(false);
        navigate('/Main'); // Navigate to main page
      }, 1500); // Reduced timeout for better UX
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
        <div className="fixed w-40 inset-0 bg-white bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-8 transform transition-all duration-300">
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

                <button
                  onClick={handleRegister}
                  disabled={!userName.trim()}
                  className="w-full bg-blue-600 text-white font-black text-lg py-3 px-6 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-x-0 disabled:hover:translate-y-0"
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