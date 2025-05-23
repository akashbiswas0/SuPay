import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AddGroupMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMembers: (members: string[]) => void;
  error?: string | null;
}

const AddGroupMembersModal: React.FC<AddGroupMembersModalProps> = ({ isOpen, onClose, onAddMembers, error }) => {
  const [memberAddresses, setMemberAddresses] = useState<string[]>(['']);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleInputChange = (index: number, value: string) => {
    const updated = [...memberAddresses];
    updated[index] = value;
    setMemberAddresses(updated);
  };

  const handleAddField = () => {
    setMemberAddresses([...memberAddresses, '']);
  };

  const handleRemoveField = (index: number) => {
    if (memberAddresses.length === 1) return;
    setMemberAddresses(memberAddresses.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const filtered = memberAddresses.map(addr => addr.trim()).filter(Boolean);
    if (filtered.length === 0) {
      setLocalError('Please enter at least one member address.');
      return;
    }
    setLocalError(null);
    onAddMembers(filtered);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Members to Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {memberAddresses.map((address, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder="Wallet address"
                value={address}
                onChange={e => handleInputChange(idx, e.target.value)}
                className="flex-1"
              />
              {memberAddresses.length > 1 && (
                <Button variant="destructive" size="icon" onClick={() => handleRemoveField(idx)}>-</Button>
              )}
            </div>
          ))}
          <Button variant="secondary" onClick={handleAddField} className="w-full mt-2">+ Add Another</Button>
        </div>
        {(localError || error) && <div className="text-red-500 text-sm mt-2">{localError || error}</div>}
        <DialogFooter>
          <Button onClick={handleSubmit} className="w-full">Add Members</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddGroupMembersModal;
