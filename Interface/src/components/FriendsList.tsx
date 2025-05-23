import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiService, LocalStorageService, Group } from '../services/api';

interface Friend {
  id: string;
  name: string;
  isGroup: boolean;
}

interface FriendsListProps {
  onFriendSelect: (friendName: string, isGroup?: boolean) => void;
  onCreateGroup: () => void;
  selectedFriend: string | null;
}

const FriendsList: React.FC<FriendsListProps> = ({ onFriendSelect, onCreateGroup, selectedFriend }) => {
  const [contacts, setContacts] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch user's groups from API
  const fetchUserGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const walletAddress = LocalStorageService.getWalletAddress();
      if (!walletAddress) {
        throw new Error('No wallet address found');
      }
      
      const groups = await ApiService.getUserGroups(walletAddress);
      
      // Convert groups to Friend format
      const groupContacts: Friend[] = groups.map((group: Group) => ({
        id: group.id,
        name: group.name,
        isGroup: true
      }));
      
      setContacts(groupContacts);
    } catch (err) {
      console.error('Error fetching user groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch groups');
      setContacts([]); // Show empty list on error
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch groups on component mount
  useEffect(() => {
    fetchUserGroups();
  }, []);
  
  // Listen for changes to selected friend to detect new groups
  useEffect(() => {
    // If selectedFriend is not null and not found in current contacts, refetch groups
    // This handles the case when a new group is created
    if (selectedFriend && !contacts.some(contact => contact.name === selectedFriend)) {
      fetchUserGroups();
    }
  }, [selectedFriend, contacts]);

  return (
    <div className="w-96 border-r-4 border-black flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b-4 border-black">
        <h2 className="text-2xl font-bold">Hommies</h2>
        <Button 
          variant="secondary" 
          className="border-4 ml-10 border-black p-0 h-10 w-10 hover:bg-blue-100 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button 
          variant="secondary" 
          className="border-4 border-black font-bold px-16 h-10 w-10 hover:bg-blue-200 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          onClick={onCreateGroup}
        >
          Create Group
        </Button>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading groups...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <div className="mb-2">Error: {error}</div>
            <button 
              onClick={fetchUserGroups}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="mb-2">No groups yet</div>
            <div className="text-sm">Create your first group to get started!</div>
          </div>
        ) : (
          contacts.map((contact) => (
            <div 
              key={contact.id}
              className={`p-4 border-b border-black cursor-pointer hover:bg-blue-50 transition-colors ${
                selectedFriend === contact.name ? 'bg-blue-100 font-bold' : ''
              }`}
              onClick={() => onFriendSelect(contact.name, contact.isGroup)}
            >
              <div className="flex items-center">
                <span className="flex-1 truncate">{contact.name}</span>
                {contact.isGroup && (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Group</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FriendsList;