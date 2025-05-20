import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Friend {
  id: number;
  name: string;
  isGroup: boolean;
}

interface FriendsListProps {
  onFriendSelect: (friendName: string, isGroup?: boolean) => void;
  onCreateGroup: () => void;
  selectedFriend: string | null;
}

const FriendsList: React.FC<FriendsListProps> = ({ onFriendSelect, onCreateGroup, selectedFriend }) => {
  // Initial friends and groups
  const initialContacts: Friend[] = [
    { id: 1, name: 'user 1', isGroup: false },
    { id: 2, name: 'user 2', isGroup: false },
    { id: 5, name: 'user 5', isGroup: false },
    { id: 6, name: 'group a', isGroup: true },
    { id: 7, name: 'group b', isGroup: true },
    { id: 8, name: 'user 5', isGroup: false },
    { id: 9, name: 'group a', isGroup: true },
    { id: 10, name: 'group b', isGroup: true },
    { id: 11, name: 'group b', isGroup: true },
    { id: 12, name: 'user 5', isGroup: false },
    { id: 13, name: 'group a', isGroup: true },
    { id: 14, name: 'group b', isGroup: true },
  ];
  
  const [contacts, setContacts] = useState<Friend[]>(initialContacts);
  
  // Listen for changes to selected friend to detect new groups
  useEffect(() => {
    // If selectedFriend is not null and not found in current contacts, it might be a new group
    if (selectedFriend && !contacts.some(contact => contact.name === selectedFriend)) {
      const newId = Math.max(...contacts.map(c => c.id)) + 1;
      setContacts([
        ...contacts,
        { 
          id: newId, 
          name: selectedFriend,
          isGroup: true // New contacts from createGroup are always groups
        }
      ]);
    }
  }, [selectedFriend]);

  return (
    <div className="w-72 border-r-4 border-black flex flex-col h-full bg-white">
      <div className="flex items-center justify-between p-4 border-b-4 border-black">
        <h2 className="text-2xl font-bold">Friends</h2>
        <Button 
          variant="secondary" 
          className="border-4 border-black p-0 h-10 w-10 hover:bg-blue-100 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
          onClick={onCreateGroup}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="overflow-y-auto flex-1">
        {contacts.map((contact) => (
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
        ))}
      </div>
    </div>
  );
};

export default FriendsList;