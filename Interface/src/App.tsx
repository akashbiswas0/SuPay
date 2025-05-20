import { WalletProvider, useWallet } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useEffect } from 'react';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Application from "./pages/Application"
import Main from "./pages/Main"

const queryClient = new QueryClient();

const WalletLogger = () => {
  const { account } = useWallet();
  useEffect(() => {
    if (account?.address) {
      console.log('Wallet connected. Address:', account.address);
    }
  }, [account?.address]);
  return null;
};

const App = () => (
  <WalletProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <WalletLogger />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/Application" element={<Application />} />
            <Route path="/Main" element={<Main />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </WalletProvider>
);

export default App;
