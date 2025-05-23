import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Users } from "lucide-react";
import { ApiService } from '@/services/api';
import SuiService from '@/services/suiService';
import { useWallet } from '@suiet/wallet-kit';

interface MakeSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupMembers: Array<{name: string, wallet: string, balance: number}>;
}

const MakeSplitModal: React.FC<MakeSplitModalProps> = ({ 
  isOpen, 
  onClose, 
  groupId,
  groupName,
  groupMembers 
}) => {
  const { signAndExecuteTransactionBlock, account } = useWallet();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reset form
      setDescription('');
      setAmount('');
      setSelectedParticipants(new Set());
      setError(null);
      setSuccessMessage(null);
      
      // Auto-select current user
      const userWallet = localStorage.getItem('supay_wallet');
      if (userWallet) {
        setSelectedParticipants(new Set([userWallet]));
      }
    }
  }, [isOpen]);

  const handleParticipantToggle = (wallet: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(wallet)) {
      newSelected.delete(wallet);
    } else {
      newSelected.add(wallet);
    }
    setSelectedParticipants(newSelected);
  };

  const handleCreateSplit = async () => {
    try {
      setCreating(true);
      setError(null);
      
      // Validation
      if (!description.trim()) {
        throw new Error('Please enter a description');
      }
      
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      if (selectedParticipants.size === 0) {
        throw new Error('Please select at least one participant');
      }
      
      if (!signAndExecuteTransactionBlock) {
        throw new Error('Wallet not connected');
      }
      
      if (!account?.address) {
        throw new Error('Wallet not connected');
      }
      
      if (!groupId) {
        throw new Error('Group ID not found');
      }
      
      // Calculate share per person
      const sharePerPerson = amountNum / selectedParticipants.size;
      const participants = Array.from(selectedParticipants);
      
      // Create expense in database
      const expenseId = `expense_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await ApiService.createExpense({
        id: expenseId,
        group_id: groupId,
        description: description.trim(),
        payer_address: account.address,
        amount: amountNum
      });
      
      // Add participants to expense
      const participantData = participants.map(wallet => ({
        participant_address: wallet,
        share_amount: sharePerPerson
      }));
      
      await ApiService.addExpenseParticipants(expenseId, participantData);
      
      // Call smart contract create_expense function
      console.log('Creating expense on smart contract:', {
        description: description.trim(),
        amount: amountNum,
        participants
      });
      
      const contractResult = await SuiService.createExpense(
        groupId,
        description.trim(),
        amountNum,
        participants,
        signAndExecuteTransactionBlock // Pass the signer function directly
      );
      
      if (!contractResult.success) {
        throw new Error(contractResult.error || 'Failed to create expense on smart contract');
      }
      
      console.log('Smart contract expense created successfully:', contractResult.transactionDigest);
      
      setSuccessMessage(`Successfully created split for ${amountNum} SUI among ${participants.length} members`);
      
      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2000);
      
    } catch (err) {
      console.error('Error creating split:', err);
      setError(err instanceof Error ? err.message : 'Failed to create split');
    } finally {
      setCreating(false);
    }
  };

  const sharePerPerson = selectedParticipants.size > 0 && amount ? 
    (parseFloat(amount) / selectedParticipants.size).toFixed(2) : '0.00';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-4 border-black shadow-brutal bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold border-b-4 border-black pb-2 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Create Split
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          {successMessage ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <div className="text-green-600 font-semibold">{successMessage}</div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="What's this expense for?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="border-2 border-black"
                    disabled={creating}
                  />
                </div>
                
                <div>
                  <Label htmlFor="amount">Total Amount (SUI)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="border-2 border-black"
                    disabled={creating}
                  />
                </div>
                
                <div>
                  <Label>Select Participants</Label>
                  <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
                    {groupMembers.map((member) => (
                      <Card key={member.wallet} className="border-2 border-gray-300">
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-3">
                            <Checkbox
                              checked={selectedParticipants.has(member.wallet)}
                              onCheckedChange={() => handleParticipantToggle(member.wallet)}
                              disabled={creating}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{member.name}</div>
                              <div className="text-xs text-gray-500">{member.wallet}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                
                {selectedParticipants.size > 0 && amount && (
                  <div className="bg-blue-50 p-4 border-2 border-blue-200 rounded">
                    <div className="text-sm text-blue-800">
                      <div className="font-semibold mb-1">Split Summary:</div>
                      <div>Total: {amount} SUI</div>
                      <div>Participants: {selectedParticipants.size}</div>
                      <div>Per person: {sharePerPerson} SUI</div>
                    </div>
                  </div>
                )}
              </div>
              
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={creating}
                  className="flex-1 border-2 border-black"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateSplit}
                  disabled={creating || !description.trim() || !amount || selectedParticipants.size === 0}
                  className="flex-1 border-4 border-black bg-green-600 hover:bg-green-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  {creating ? 'Creating...' : 'Create Split'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MakeSplitModal;
