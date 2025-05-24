import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle } from "lucide-react";
import { ApiService } from '@/services/api';
import SuiService, { MemberDebt } from '@/services/suiService';
import { useWallet } from '@suiet/wallet-kit';

interface SettleDebtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
}

interface DebtInfo {
  creditor: string;
  creditorName: string;
  amount: number;
  settling?: boolean; // Add settling state per debt
}

const SettleDebtsModal: React.FC<SettleDebtsModalProps> = ({ 
  isOpen, 
  onClose, 
  groupId,
  groupName 
}) => {
  const { account, signAndExecuteTransactionBlock } = useWallet();
  const [debts, setDebts] = useState<DebtInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Enhanced effect to depend on account.address as well
  useEffect(() => {
    console.log('SettleDebtsModal effect triggered - isOpen:', isOpen, 'groupId:', groupId, 'account:', account);
    
    if (isOpen && groupId) {
      if (!account?.address) {
        console.warn('Modal is open but wallet is not connected. Waiting for wallet connection...');
        // Set an error state for the user
        setError('Wallet not connected. Please connect your wallet to view your debts.');
      } else {
        console.log('Wallet is connected, fetching user debts');
        fetchUserDebts();
      }
    }
  }, [isOpen, groupId, account?.address]); // Add account.address as a dependency

  const fetchUserDebts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if wallet is connected and account address is available
      if (!account?.address) {
        console.error('Wallet not connected or account address missing');
        setError('Wallet not connected. Please connect your wallet to view your debts.');
        setLoading(false);
        return;
      }

      // Check if group ID is valid
      if (!groupId || groupId === '') {
        console.error('Invalid group ID:', groupId);
        setError('Invalid group ID. Please try again.');
        setLoading(false);
        return;
      }

      // Fetch real debts from smart contract with better logging
      console.log('Fetching debts for user:', account.address, 'in group:', groupId);
      
      // Get both debts and credits for complete picture
      let memberDebts = [];
      let netBalance = null;
      
      try {
        // First try to get member debts
        console.log('Calling SuiService.getMemberDebts...');
        memberDebts = await SuiService.getMemberDebts(groupId, account.address);
        console.log('getMemberDebts result:', memberDebts);
        
        // --- LOGGING: Show all creditor addresses parsed for UI ---
        if (Array.isArray(memberDebts)) {
          console.log('Creditor addresses for UI:', memberDebts.map((d: any) => d.creditor));
        }
        
        // Then get net balance
        console.log('Calling SuiService.getNetBalance...');
        netBalance = await SuiService.getNetBalance(groupId, account.address);
        console.log('getNetBalance result:', netBalance);
      } catch (contractErr) {
        console.error('Error calling contract methods:', contractErr);
        setError(`Error fetching data from smart contract: ${contractErr.message || 'Unknown error'}`);
        setLoading(false);
        return;
      }
      
      // If no memberDebts but netBalance shows a debt, create a synthetic debt entry
      if ((Array.isArray(memberDebts) && memberDebts.length === 0) && netBalance && !netBalance.is_positive && netBalance.debt_amount > 0) {
        setDebts([
          {
            creditor: 'Unknown',
            creditorName: 'Group',
            amount: netBalance.debt_amount
          }
        ]);
        setLoading(false);
        return;
      }
      // If memberDebts is not empty, always use it (never create synthetic debt)
      if (Array.isArray(memberDebts) && memberDebts.length > 0) {
        // Convert to DebtInfo format and get creditor names
        const debtsWithNames = await Promise.all(
          memberDebts.map(async (debt: MemberDebt) => {
            try {
              const user = await ApiService.getUserByWallet(debt.creditor);
              return {
                creditor: debt.creditor,
                creditorName: user?.name || `${debt.creditor.slice(0, 6)}...${debt.creditor.slice(-4)}`,
                amount: debt.amount
              };
            } catch (err) {
              return {
                creditor: debt.creditor,
                creditorName: `${debt.creditor.slice(0, 6)}...${debt.creditor.slice(-4)}`,
                amount: debt.amount
              };
            }
          })
        );
        debtsWithNames.sort((a, b) => b.amount - a.amount);
        setDebts(debtsWithNames);
        setLoading(false);
        return;
      }
      
      if (!memberDebts || memberDebts.length === 0) {
        console.log('No debts found for this user');
        setDebts([]);
        setLoading(false);
        return;
      }
      
    } catch (err) {
      console.error('Error in fetchUserDebts:', err);
      setError(`Failed to fetch debts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleAll = async () => {
    if (debts.length === 0) return;
    
    try {
      setSettling(true);
      setError(null);
      
      if (!account?.address) {
        throw new Error('Wallet not connected');
      }

      let totalSettled = 0;
      let failedSettlements = 0;
      
      // Settle each debt through the smart contract
      for (const debt of debts) {
        try {
          // --- LOGGING: Show both address and name ---
          console.log('About to pay:', {
            groupId,
            creditorAddress: debt.creditor,
            creditorName: debt.creditorName,
            amount: debt.amount,
            sender: account.address
          });
          // Validate creditor address format
          if (!debt.creditor.startsWith('0x') || debt.creditor.length !== 66) {
            console.error('Invalid creditor address! Not a valid Sui address:', debt.creditor);
          }
          
          console.log(`Paying ${debt.amount} SUI to ${debt.creditorName} using pay_member`);
          
          // Call smart contract settle_debt function 
          if (!signAndExecuteTransactionBlock) {
            throw new Error('Wallet not connected or signing function not available');
          }
          
          // Use pay_member instead of settle_debt
          const paymentResult = await SuiService.payMember(
            groupId,
            debt.creditor, // always use address
            debt.amount,
            account.address,
            signAndExecuteTransactionBlock
          );
          
          if (paymentResult.success) {
            // Create settlement record in database for tracking
            await ApiService.createSettlement({
              id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              group_id: groupId,
              from_address: account.address,
              to_address: debt.creditor,
              amount: debt.amount,
              note: `Payment for outstanding debt in ${groupName}`
            });
            
            totalSettled += debt.amount;
            console.log(`Successfully paid ${debt.amount} SUI to ${debt.creditorName}`);
          } else {
            console.error(`Failed to pay debt to ${debt.creditorName}:`, paymentResult.error);
            failedSettlements++;
          }
        } catch (err) {
          console.error(`Error paying debt to ${debt.creditorName}:`, err);
          failedSettlements++;
        }
      }
      
      if (failedSettlements === 0) {
        setSuccessMessage(`Successfully paid ${totalSettled} SUI across ${debts.length} debt(s)`);
        setDebts([]); // Clear debts after settlement
      } else {
        const successfulSettlements = debts.length - failedSettlements;
        if (successfulSettlements > 0) {
          setSuccessMessage(`Paid ${totalSettled} SUI in ${successfulSettlements} transaction(s). ${failedSettlements} failed.`);
          // Refresh debt list to show updated state
          fetchUserDebts();
        } else {
          setError('All payment transactions failed. Please try again.');
        }
      }
      
      // Auto-close modal after 3 seconds if all successful
      if (failedSettlements === 0) {
        setTimeout(() => {
          setSuccessMessage(null);
          onClose();
        }, 3000);
      }
      
    } catch (err) {
      console.error('Error paying debts:', err);
      setError(err instanceof Error ? err.message : 'Failed to pay debts');
    } finally {
      setSettling(false);
    }
  };

  const handleSettleIndividualDebt = async (debtIndex: number) => {
    const debt = debts[debtIndex];
    if (!debt || !account?.address) return;
    
    // Update local state to show this debt is being settled
    const updatedDebts = [...debts];
    updatedDebts[debtIndex] = { ...debt, settling: true };
    setDebts(updatedDebts);
    
    try {
      setError(null);
      // --- LOGGING: Show both address and name ---
      console.log('About to pay (individual):', {
        groupId,
        creditorAddress: debt.creditor,
        creditorName: debt.creditorName,
        amount: debt.amount,
        sender: account.address
      });
      // Validate creditor address format
      if (!debt.creditor.startsWith('0x') || debt.creditor.length !== 66) {
        console.error('Invalid creditor address! Not a valid Sui address:', debt.creditor);
      }
      
      console.log(`Paying ${debt.amount} SUI to ${debt.creditorName} using pay_member`);
      
      // Call smart contract settle_debt function
      const paymentResult = await SuiService.payMember(
        groupId,
        debt.creditor, // always use address
        debt.amount,
        account.address,
        signAndExecuteTransactionBlock
      );
      
      if (paymentResult.success) {
        // Create settlement record in database for tracking
        await ApiService.createSettlement({
          id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          group_id: groupId,
          from_address: account.address,
          to_address: debt.creditor,
          amount: debt.amount,
          note: `Individual payment for debt in ${groupName}`
        });
        
        // Remove this debt from the list
        const newDebts = debts.filter((_, index) => index !== debtIndex);
        setDebts(newDebts);
        
        setSuccessMessage(`Successfully paid ${debt.amount} SUI to ${debt.creditorName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
        
        console.log(`Successfully paid ${debt.amount} SUI to ${debt.creditorName}`);
      } else {
        console.error(`Failed to pay debt to ${debt.creditorName}:`, paymentResult.error);
        setError(`Failed to pay debt to ${debt.creditorName}: ${paymentResult.error}`);
        
        // Reset settling state on failure
        const revertedDebts = [...debts];
        revertedDebts[debtIndex] = { ...debt, settling: false };
        setDebts(revertedDebts);
      }
    } catch (err) {
      console.error(`Error paying debt to ${debt.creditorName}:`, err);
      setError(`Error paying debt: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Reset settling state on error
      const revertedDebts = [...debts];
      revertedDebts[debtIndex] = { ...debt, settling: false };
      setDebts(revertedDebts);
    }
  };

  const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl border-4 border-black shadow-brutal bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold border-b-4 border-black pb-2">
            Settle Outstanding Debts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading your debts...</div>
            </div>
          ) : error ? (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <div className="text-red-500 text-sm">{error}</div>
              {error.includes('Wallet not connected') ? (
                <div className="mt-4 text-sm text-gray-600">
                  <p>Please make sure your wallet is connected and you have access to this group.</p>
                  <p className="mt-2">If you just connected your wallet, you may need to refresh the page.</p>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={fetchUserDebts}
                  className="mt-2"
                >
                  Retry
                </Button>
              )}
            </div>
          ) : successMessage ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <div className="text-green-600 font-semibold">{successMessage}</div>
            </div>
          ) : debts.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <div className="text-green-600 font-semibold">
                You have no outstanding debts in this group!
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-gray-600 uppercase tracking-wide">
                  Your Debts to Settle ({debts.length})
                </h3>
                <div className="mb-2 p-3 bg-orange-50 border-2 border-orange-200 rounded">
                  <div className="text-sm text-orange-700">
                    These are debts you owe to others. Settling these will eliminate your obligations in the group.
                  </div>
                </div>
                {debts.map((debt, index) => (
                  <Card key={index} className="border-2 border-black">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold">You owe {debt.creditorName}</div>
                          <div className="text-xs text-gray-500">{debt.creditor}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">{debt.amount} SUI</div>
                        </div>
                      </div>
                      {debt.creditor === 'Unknown' && (
                        <div className="mt-2 text-xs text-orange-700 bg-orange-100 border border-orange-300 rounded p-2">
                          This is a synthetic debt. The actual creditor could not be determined, so you cannot settle this debt directly. Please wait for group activity to resolve this balance.
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        {debt.settling ? (
                          <Button
                            className="w-full border-4 border-black bg-gray-400 cursor-not-allowed"
                            disabled
                          >
                            Settling...
                          </Button>
                        ) : debt.creditor === 'Unknown' ? (
                          <Button
                            className="w-full border-4 border-black bg-gray-300 text-gray-500 cursor-not-allowed"
                            disabled
                          >
                            Cannot Pay
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSettleIndividualDebt(index)}
                            className="w-full border-4 border-black bg-red-600 hover:bg-red-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                          >
                            Pay {debt.amount} SUI
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="bg-gray-50 p-4 border-2 border-black rounded">
                <div className="flex justify-between items-center font-bold">
                  <span>Total You Owe:</span>
                  <span className="text-red-600">{totalAmount} SUI</span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Settling all debts will clear your obligations in this group.
                </div>
              </div>
              
              <Button
                onClick={handleSettleAll}
                disabled={settling || debts.length === 0 || debts.some((debt) => debt.creditor === 'Unknown')}
                className={`w-full border-4 border-black bg-red-600 hover:bg-red-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all ${debts.some((debt) => debt.creditor === 'Unknown') ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {settling ? 'Settling...' : `Pay All Your Debts (${totalAmount} SUI)`}
              </Button>
              {debts.some((debt) => debt.creditor === 'Unknown') && (
                <div className="mt-2 text-xs text-orange-700 bg-orange-100 border border-orange-300 rounded p-2">
                  Some debts cannot be settled directly because the actual creditor could not be determined. These will resolve automatically as group activity continues.
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettleDebtsModal;
