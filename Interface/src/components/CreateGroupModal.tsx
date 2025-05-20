import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (groupName: string) => Promise<void>;
  error?: string | null;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreateGroup,
  error 
}) => {
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    
    try {
      setIsLoading(true);
      await onCreateGroup(groupName);
      setGroupName('');
      onClose();
    } catch (error) {
      // Error is already handled in parent component
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-4 border-black shadow-brutal bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold border-b-4 border-black pb-2">
            Create Group
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div>
            <Input
              placeholder="Group name"
              className="border-4 border-black"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mt-2">
              Error: {error}
            </div>
          )}
          
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isLoading}
              className="border-4 border-black bg-blue-600 hover:bg-blue-700 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateGroupModal;