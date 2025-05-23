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

  useEffect(() => {
    if (isOpen && groupId) {
      fetchUserDebts();
    }
  }, [isOpen, groupId]);

  const fetchUserDebts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!account?.address) {
        setError('Wallet not connected');
        return;
      }

      // Fetch real debts from smart contract
      console.log('Fetching debts for user:', account.address, 'in group:', groupId);
      const memberDebts = await SuiService.getMemberDebts(groupId, account.address);
      console.log('Fetched member debts:', memberDebts);
      
      // Convert to DebtInfo format and get creditor names
      const debtsWithNames = await Promise.all(
        memberDebts.map(async (debt: MemberDebt) => {
          try {
            // Try to get user name from database
            const user = await ApiService.getUserByWallet(debt.creditor);
            return {
              creditor: debt.creditor,
              creditorName: user?.name || `${debt.creditor.slice(0, 6)}...${debt.creditor.slice(-4)}`,
              amount: debt.amount
            };
          } catch (err) {
            console.error('Error fetching creditor name:', err);
            return {
              creditor: debt.creditor,
              creditorName: `${debt.creditor.slice(0, 6)}...${debt.creditor.slice(-4)}`,
              amount: debt.amount
            };
          }
        })
      );
      
      setDebts(debtsWithNames);
    } catch (err) {
      console.error('Error fetching user debts:', err);
      setError('Failed to fetch debts from smart contract');
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
          console.log(`Settling debt of ${debt.amount} SUI to ${debt.creditorName}`);
          
          // Call smart contract settle_debt function 
          if (!signAndExecuteTransactionBlock) {
            throw new Error('Wallet not connected or signing function not available');
          }
          
          const settlementResult = await SuiService.settleDebt(
            groupId,
            debt.creditor,
            debt.amount,
            account.address,
            signAndExecuteTransactionBlock
          );
          
          if (settlementResult.success) {
            // Create settlement record in database for tracking
            await ApiService.createSettlement({
              id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              group_id: groupId,
              from_address: account.address,
              to_address: debt.creditor,
              amount: debt.amount,
              note: `Settlement for outstanding debt in ${groupName}`
            });
            
            totalSettled += debt.amount;
            console.log(`Successfully settled ${debt.amount} SUI to ${debt.creditorName}`);
          } else {
            console.error(`Failed to settle debt to ${debt.creditorName}:`, settlementResult.error);
            failedSettlements++;
          }
        } catch (err) {
          console.error(`Error settling debt to ${debt.creditorName}:`, err);
          failedSettlements++;
        }
      }
      
      if (failedSettlements === 0) {
        setSuccessMessage(`Successfully settled ${totalSettled} SUI across ${debts.length} debt(s)`);
        setDebts([]); // Clear debts after settlement
      } else {
        const successfulSettlements = debts.length - failedSettlements;
        if (successfulSettlements > 0) {
          setSuccessMessage(`Settled ${totalSettled} SUI in ${successfulSettlements} transaction(s). ${failedSettlements} failed.`);
          // Refresh debt list to show updated state
          fetchUserDebts();
        } else {
          setError('All settlement transactions failed. Please try again.');
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
      console.error('Error settling debts:', err);
      setError(err instanceof Error ? err.message : 'Failed to settle debts');
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
      
      console.log(`Settling debt of ${debt.amount} SUI to ${debt.creditorName}`);
      
      // Call smart contract settle_debt function
      const settlementResult = await SuiService.settleDebt(
        groupId,
        debt.creditor,
        debt.amount,
        account.address,
        signAndExecuteTransactionBlock
      );
      
      if (settlementResult.success) {
        // Create settlement record in database for tracking
        await ApiService.createSettlement({
          id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          group_id: groupId,
          from_address: account.address,
          to_address: debt.creditor,
          amount: debt.amount,
          note: `Individual settlement for debt in ${groupName}`
        });
        
        // Remove this debt from the list
        const newDebts = debts.filter((_, index) => index !== debtIndex);
        setDebts(newDebts);
        
        setSuccessMessage(`Successfully settled ${debt.amount} SUI to ${debt.creditorName}`);
        setTimeout(() => setSuccessMessage(null), 3000);
        
        console.log(`Successfully settled ${debt.amount} SUI to ${debt.creditorName}`);
      } else {
        console.error(`Failed to settle debt to ${debt.creditorName}:`, settlementResult.error);
        setError(`Failed to settle debt to ${debt.creditorName}: ${settlementResult.error}`);
        
        // Reset settling state on failure
        const revertedDebts = [...debts];
        revertedDebts[debtIndex] = { ...debt, settling: false };
        setDebts(revertedDebts);
      }
    } catch (err) {
      console.error(`Error settling debt to ${debt.creditorName}:`, err);
      setError(`Error settling debt: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Reset settling state on error
      const revertedDebts = [...debts];
      revertedDebts[debtIndex] = { ...debt, settling: false };
      setDebts(revertedDebts);
    }
  };

  const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-4 border-black shadow-brutal bg-white">
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
              <Button
                variant="outline"
                onClick={fetchUserDebts}
                className="mt-2"
              >
                Retry
              </Button>
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
                  Debts to Settle ({debts.length})
                </h3>
                {debts.map((debt, index) => (
                  <Card key={index} className="border-2 border-black">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-semibold">{debt.creditorName}</div>
                          <div className="text-xs text-gray-500">{debt.creditor}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">{debt.amount} SUI</div>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        {debt.settling ? (
                          <Button
                            className="w-full border-4 border-black bg-gray-400 cursor-not-allowed"
                            disabled
                          >
                            Settling...
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSettleIndividualDebt(index)}
                            className="w-full border-4 border-black bg-red-600 hover:bg-red-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                          >
                            Settle This Debt ({debt.amount} SUI)
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="bg-gray-50 p-4 border-2 border-black rounded">
                <div className="flex justify-between items-center font-bold">
                  <span>Total to Settle:</span>
                  <span className="text-red-600">{totalAmount} SUI</span>
                </div>
              </div>
              
              <Button
                onClick={handleSettleAll}
                disabled={settling || debts.length === 0}
                className="w-full border-4 border-black bg-red-600 hover:bg-red-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              >
                {settling ? 'Settling...' : `Settle All Debts (${totalAmount} SUI)`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettleDebtsModal;
