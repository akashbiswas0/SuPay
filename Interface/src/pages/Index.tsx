import { useState, useEffect } from "react";
import { ArrowRight, Wallet, Users, MessageCircle, Send, UserPlus, Calculator, Clock, BarChart3, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import { ApiService, LocalStorageService, User } from '@/services/api';


const Index = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCheckingUser, setIsCheckingUser] = useState(false);

  const navigate = useNavigate();
  const { connected, account } = useWallet();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle wallet connection and user authentication
  useEffect(() => {
    const handleWalletConnection = async () => {
      if (connected && account?.address) {
        setIsCheckingUser(true);
        
        try {
          // Check if user exists in database
          const existingUser = await ApiService.getUserByWallet(account.address);
          
          if (existingUser) {
            // User exists - save to localStorage and redirect
            LocalStorageService.saveUser(existingUser);
            LocalStorageService.saveWalletAddress(account.address);
            console.log('✅ User logged in:', existingUser);
            navigate('/main');
          } else {
            // New user - redirect to registration page
            console.log('👤 New user detected, redirecting to registration page');
            navigate('/application');
          }
        } catch (error) {
          console.error('❌ Error checking user:', error);
          // On error, still redirect to registration page as fallback
          navigate('/application');
        } finally {
          setIsCheckingUser(false);
        }
      }
    };

    handleWalletConnection();
  }, [connected, account, navigate]);

  const handleUserCreated = (user: User) => {
    // Save user data to localStorage
    LocalStorageService.saveUser(user);
    LocalStorageService.saveWalletAddress(account!.address);
    
    // Close modal and redirect
    console.log('✅ User registered and logged in:', user);
    navigate('/main');
  };

  const features = [
    {
      icon: <Wallet className="h-8 w-8" />,
      title: "Create ID",
      description: "Establish a unique username profile on Sui Network"
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Connect",
      description: "Add friends to your network and build connections"
    },
    {
      icon: <MessageCircle className="h-8 w-8" />,
      title: "Chat",
      description: "Initiate conversations and send messages securely"
    },
    {
      icon: <Send className="h-8 w-8" />,
      title: "Send Payments",
      description: "Transfer SUI coins with transaction history in chats"
    },
    {
      icon: <UserPlus className="h-8 w-8" />,
      title: "Group Up",
      description: "Create groups for various purposes and activities"
    },
    {
      icon: <Calculator className="h-8 w-8" />,
      title: "Split Bills",
      description: "Automatically divide payments among group members"
    },
    {
      icon: <Clock className="h-8 w-8" />,
      title: "Request Funds",
      description: "Send payment requests to friends instantly"
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Track Everything",
      description: "Access conversation and transaction history with analytics"
    }
  ];

  const testimonials = [
    {
      name: "Alex Chen",
      role: "DeFi Enthusiast",
      content: "SuPay has revolutionized how I handle payments on Sui. The social features make crypto transactions feel natural and intuitive."
    },
    {
      name: "Sarah Kim",
      role: "Crypto Trader",
      content: "The group payment features are incredible. Splitting bills has never been this easy with crypto. Game changer!"
    },
    {
      name: "Michael Rodriguez",
      role: "Blockchain Developer",
      content: "Clean UI, fast transactions, and great UX. SuPay is setting the standard for payment DApps on Sui Network."
    }
  ];

  const faqs = [
    {
      question: "What is SuPay?",
      answer: "SuPay is a decentralized payment application built on the Sui blockchain that combines social features with seamless payment solutions."
    },
    {
      question: "How do I connect my wallet?",
      answer: "Click the 'Connect Wallet' button in the top-right corner and select your preferred Sui-compatible wallet."
    },
    {
      question: "Are my transactions secure?",
      answer: "Yes, all transactions are secured by the Sui blockchain's robust security protocols and cryptographic standards."
    },
    {
      question: "Can I use SuPay on mobile?",
      answer: "Absolutely! SuPay is designed to be fully responsive and works seamlessly across all devices."
    }
  ];

  return (
    <div className="min-h-screen bg-white text-black overflow-x-hidden">
      {/* Navigation */}
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

      {/* Hero Section */}
      <section id="home" className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="animate-fade-in">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6">
                <span className="text-black">All-in-one</span>{" "}
                <span className="text-blue-600">payment solutions</span>{" "}
                <span className="text-black">in one place on</span>{" "}
                <span className="bg-blue-600 text-white px-4 py-2 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] inline-block transform -rotate-2">
                  Sui Network
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-gray-700 mb-8 max-w-3xl mx-auto font-semibold">
                Seamlessly integrate payments with social features. Chat, send money, split bills, and track everything on the fastest blockchain.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 text-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all transform hover:-translate-y-1">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button variant="outline" className="bg-white text-black font-bold px-8 py-4 text-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all transform hover:-translate-y-1">
                  Watch Demo
                </Button>
              </div>
            </div>
            
            {/* Hero Visual */}
            <div className="mt-16 relative">
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] p-8 transform rotate-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-white/80 backdrop-blur-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-6 text-center">
                      <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="font-bold text-lg mb-2">Chat & Pay</h3>
                      <p className="text-gray-600">Send messages and money in one flow</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/80 backdrop-blur-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transform -rotate-2">
                    <CardContent className="p-6 text-center">
                      <Calculator className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="font-bold text-lg mb-2">Split Bills</h3>
                      <p className="text-gray-600">Automatic payment splitting for groups</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white/80 backdrop-blur-sm border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-6 text-center">
                      <BarChart3 className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                      <h3 className="font-bold text-lg mb-2">Track All</h3>
                      <p className="text-gray-600">Complete transaction analytics</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              Powerful <span className="text-blue-600">Features</span>
            </h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto font-semibold">
              Everything you need to manage payments and social interactions on the Sui blockchain
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all transform hover:-translate-y-2 group">
                <CardContent className="p-6 text-center">
                  <div className="text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                  <h3 className="font-bold text-lg mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              What Users <span className="text-blue-600">Say</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-blue-50/50 backdrop-blur-sm border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transform rotate-1 hover:rotate-0 transition-all">
                <CardContent className="p-8">
                  <p className="text-gray-700 mb-6 text-lg leading-relaxed">"{testimonial.content}"</p>
                  <div>
                    <p className="font-bold text-lg">{testimonial.name}</p>
                    <p className="text-blue-600 font-semibold">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              Frequently Asked <span className="text-blue-600">Questions</span>
            </h2>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-8">
                  <h3 className="font-bold text-xl mb-4">{faq.question}</h3>
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-blue-600 text-white p-12 border-4 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] transform -rotate-1">
            <h2 className="text-4xl sm:text-5xl font-black mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl mb-8 font-semibold">
              Join thousands of users already using SuPay for seamless payments on Sui Network
            </p>
            <Button className="bg-white text-blue-600 hover:bg-gray-100 font-bold px-8 py-4 text-lg border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all transform hover:-translate-y-1">
              Launch App Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-black text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="text-3xl font-black text-blue-400 mb-4">SuPay</div>
              <p className="text-gray-300 leading-relaxed">
                The future of payments on Sui Network. Social, fast, and secure.
              </p>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Product</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Roadmap</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-blue-400 transition-colors">About</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Press</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-bold text-lg mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-300">
                <li><a href="#" className="hover:text-blue-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-blue-400 transition-colors">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 mb-4 md:mb-0">
                © 2024 SuPay. All rights reserved.
              </p>
              <div className="flex space-x-6">
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">Twitter</a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">Discord</a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">GitHub</a>
                <a href="#" className="text-gray-400 hover:text-blue-400 transition-colors">Telegram</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
