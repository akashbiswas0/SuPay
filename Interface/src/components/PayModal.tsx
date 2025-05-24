import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWallet } from '@suiet/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';

interface PayModalProps {
  isOpen: boolean;
  onClose: () => void;
  friendName: string;
  friendWalletAddress: string;
}

const PayModal: React.FC<PayModalProps> = ({
  isOpen,
  onClose,
  friendName,
  friendWalletAddress
}) => {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const { signAndExecuteTransactionBlock, account } = useWallet();

  const handlePay = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!account?.address) {
      setError('Wallet not connected');
      return;
    }

    if (!signAndExecuteTransactionBlock) {
      setError('Wallet signing function not available');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      // Convert amount to MIST (1 SUI = 1,000,000,000 MIST)
      const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);

      console.log(`Initiating payment of ${amount} SUI (${amountInMist} MIST) to ${friendName} (${friendWalletAddress})`);

      // Create transaction block for direct SUI transfer
      const txb = new TransactionBlock();
      
      // Create a coin object with the payment amount
      const [coin] = txb.splitCoins(txb.gas, [txb.pure(amountInMist)]);
      
      // Transfer the coin to the recipient
      txb.transferObjects([coin], txb.pure(friendWalletAddress, 'address'));

      // Execute the transaction
      const result = await signAndExecuteTransactionBlock({
        transactionBlock: txb as any,
        options: { showEffects: true },
      });

      console.log('Payment successful:', result);

      // Reset form and close modal
      setAmount('');
      setNote('');
      onClose();

      // You could also add the payment as a message to the chat here
      // or trigger a refresh of balances

    } catch (err) {
      console.error('Payment failed:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (!isProcessing) {
      setAmount('');
      setNote('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="border-4 border-black bg-white shadow-brutal-lg max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Pay {friendName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center text-sm text-gray-600">
            <p>Recipient: {friendName}</p>
            <p className="font-mono text-xs break-all">
              {friendWalletAddress}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="font-bold">
              Amount (SUI)
            </Label>
            <Input
              id="amount"
              type="number"
              step="0.000000001"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="border-4 border-black font-semibold text-lg text-center"
              disabled={isProcessing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note" className="font-bold">
              Note (Optional)
            </Label>
            <Input
              id="note"
              placeholder="What's this payment for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border-4 border-black font-semibold"
              disabled={isProcessing}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm font-semibold text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              className="flex-1 border-4 border-black font-bold shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePay}
              className="flex-1 border-4 border-black bg-green-600 hover:bg-green-700 text-white font-bold shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              disabled={isProcessing || !amount || parseFloat(amount) <= 0}
            >
              {isProcessing ? 'Processing...' : `Pay ${amount || '0'} SUI`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PayModal;
