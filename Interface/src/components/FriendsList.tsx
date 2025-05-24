import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiService, LocalStorageService, Group, User } from '../services/api';

interface Friend {
  id: string;
  name: string;
  isGroup: boolean;
  walletAddress?: string; // For friends only
}

interface FriendsListProps {
  onFriendSelect: (friendName: string, isGroup?: boolean, walletAddress?: string) => void;
  onCreateGroup: () => void;
  selectedFriend: string | null;
  onAddFriend: () => void;
  refreshTrigger?: number; // Add this to trigger refreshes
}

const FriendsList: React.FC<FriendsListProps> = ({ onFriendSelect, onCreateGroup, selectedFriend, onAddFriend, refreshTrigger }) => {
  const [contacts, setContacts] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch user's groups and friends from API
  const fetchUserContactsAndGroups = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const walletAddress = LocalStorageService.getWalletAddress();
      if (!walletAddress) {
        throw new Error('No wallet address found');
      }
      
      // Get current user to fetch friends
      const currentUser = await ApiService.getUserByWallet(walletAddress);
      if (!currentUser) {
        throw new Error('Current user not found');
      }
      
      // Fetch both groups and friends in parallel
      const [groups, friends] = await Promise.all([
        ApiService.getUserGroups(walletAddress),
        ApiService.getUserFriends(currentUser.id.toString())
      ]);
      
      console.log('Fetched groups:', groups.length);
      console.log('Fetched friends:', friends.length);
      
      // Convert groups to Friend format
      const groupContacts: Friend[] = groups.map((group: Group) => ({
        id: group.id,
        name: group.name,
        isGroup: true
      }));
      
      // Convert friends to Friend format
      const friendContacts: Friend[] = friends.map((friend: User) => ({
        id: friend.id.toString(),
        name: friend.name,
        isGroup: false,
        walletAddress: friend.wallet_address
      }));
      
      // Combine friends and groups
      const allContacts = [...friendContacts, ...groupContacts];
      setContacts(allContacts);
    } catch (err) {
      console.error('Error fetching user contacts and groups:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch contacts and groups');
      setContacts([]); // Show empty list on error
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch contacts and groups on component mount
  useEffect(() => {
    fetchUserContactsAndGroups();
  }, []);
  
  // Listen for refreshTrigger changes to refresh data
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      fetchUserContactsAndGroups();
    }
  }, [refreshTrigger]);
  
  // Listen for changes to selected friend to detect new groups or friends
  useEffect(() => {
    // If selectedFriend is not null and not found in current contacts, refetch
    // This handles the case when a new group is created or friend is added
    if (selectedFriend && !contacts.some(contact => contact.name === selectedFriend)) {
      fetchUserContactsAndGroups();
    }
  }, [selectedFriend, contacts]);

  return (
    <div className="w-96 border-r-4 border-h-full border-black flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b-4 border-black">
        <h2 className="text-2xl font-bold">Hommies</h2>
        <Button 
          variant="secondary" 
          onClick={onAddFriend}
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
          <div className="p-4 text-center text-gray-500">Loading friends and groups...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <div className="mb-2">Error: {error}</div>
            <button 
              onClick={fetchUserContactsAndGroups}
              className="text-blue-600 underline hover:text-blue-800"
            >
              Retry
            </button>
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <div className="mb-2">No friends or groups found</div>
            <div className="text-sm">Add friends or create a group to get started!</div>
          </div>
        ) : (
          contacts.map((contact) => (
            <div 
              key={contact.id}
              className={`p-4 border-b border-black cursor-pointer hover:bg-blue-50 transition-colors ${
                selectedFriend === contact.name ? 'bg-blue-100 font-bold' : ''
              }`}
              onClick={() => onFriendSelect(contact.name, contact.isGroup, contact.walletAddress)}
            >
              <div className="flex items-center">
                <span className="flex-1 truncate">{contact.name}</span>
                {contact.isGroup ? (
                  <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">Group</span>
                ) : (
                  <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">Friend</span>
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