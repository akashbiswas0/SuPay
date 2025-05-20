import React from 'react'
import '@suiet/wallet-kit/style.css';
import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import { ArrowRight, Wallet, Users, MessageCircle, Send, UserPlus, Calculator, Clock, BarChart3, Menu, X } from "lucide-react";
import { useState, useEffect } from "react";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        const handleScroll = () => {
          setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
      }, []);
    

  return (
    <div>
        <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/80 backdrop-blur-md border-b border-gray-200' 
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="text-2xl font-black text-blue-600">SuPay</div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a href="#home" className="text-black hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Home</a>
                <a href="#features" className="text-black hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Features</a>
                <a href="#about" className="text-black hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">About</a>
                <a href="#contact" className="text-black hover:text-blue-600 px-3 py-2 text-sm font-semibold transition-colors">Contact</a>
              </div>
            </div>

            <div className="hidden md:block">
             
                <ConnectButton />
            {/* className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 border-2 border-blue-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all" */}
                      
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-black hover:text-blue-600 p-2"
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-b border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a href="#home" className="block px-3 py-2 text-base font-semibold text-black hover:text-blue-600">Home</a>
              <a href="#features" className="block px-3 py-2 text-base font-semibold text-black hover:text-blue-600">Features</a>
              <a href="#about" className="block px-3 py-2 text-base font-semibold text-black hover:text-blue-600">About</a>
              <a href="#contact" className="block px-3 py-2 text-base font-semibold text-black hover:text-blue-600">Contact</a>
              <div className="px-3 py-2">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 border-2 border-blue-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  Connect Wallet
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>
      </div>
  )
}

export default Navbar