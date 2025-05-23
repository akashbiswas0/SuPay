import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiService } from '@/services/api';
import SuiService, { NetBalance } from '@/services/suiService';
import SettleDebtsModal from './SettleDebtsModal';
import MakeSplitModal from './MakeSplitModal';

interface ChatWindowProps {
  friendName: string;
  isGroup: boolean;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isPayment?: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ friendName, isGroup }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [groupMembers, setGroupMembers] = useState<{name: string, wallet: string, balance: number, netBalance?: NetBalance}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);

  // When the selected friend/group changes, reset messages
  useEffect(() => {
    // In a real app, we would fetch conversation history here
    setMessages([]);
  }, [friendName]);

  useEffect(() => {
    if (isGroup) {
      setLoadingMembers(true);
      // Fetch group info by name, then fetch members and their balances
      (async () => {
        // 1. Get group by name
        const walletAddress = localStorage.getItem('supay_wallet');
        let group = null;
        if (walletAddress) {
          const groups = await ApiService.getUserGroups(walletAddress);
          console.log('Fetched groups for wallet', walletAddress, groups); // LOG
          group = groups.find((g: any) => g.name === friendName);
          console.log('Matched group by name', friendName, group); // LOG
          setCurrentGroup(group); // Store the current group
        }
        if (!group) {
          console.log('No group found for name', friendName); // LOG
          setGroupMembers([]);
          setLoadingMembers(false);
          return;
        }
        // 2. Get members from backend
        const groupMembersUrl = `http://localhost:3000/user_groups/group/${group.id}`;
        console.log('Fetching group members from', groupMembersUrl); // LOG
        const res = await fetch(groupMembersUrl);
        const userGroups = await res.json();
        console.log('Fetched userGroups for group.id', group.id, userGroups); // LOG
        if (!Array.isArray(userGroups)) {
          console.error('userGroups is not an array:', userGroups);
        }
        // 3. For each member, get user info and balance from smart contract
        const members = await Promise.all(userGroups.map(async (ug: any, idx: number) => {
          console.log('Processing userGroup entry', idx, ug);
          try {
            // Use ApiService.getUserById to fetch user details by UUID
            const user = await ApiService.getUserById(ug.user_id);
            console.log('Fetched user for member', ug, user); // LOG
            
            // Fetch real balance from smart contract if we have a group ID
            let netBalance: NetBalance | undefined;
            let displayBalance = 0;
            
            if (group.id && user?.wallet_address) {
              try {
                console.log('Fetching smart contract balance for:', user.wallet_address, 'in group:', group.id);
                netBalance = await SuiService.getNetBalance(group.id, user.wallet_address);
                console.log('Smart contract balance result:', netBalance);
                
                // Display net balance (positive means they are owed money, negative means they owe money)
                displayBalance = netBalance.is_positive ? netBalance.net_amount : -netBalance.debt_amount;
              } catch (contractError) {
                console.error('Error fetching balance from smart contract:', contractError);
                // Fallback to 0 if contract call fails
                displayBalance = 0;
              }
            }
            
            return {
              name: user?.name || ug.user_id,
              wallet: user?.wallet_address || ug.user_id,
              balance: displayBalance,
              netBalance
            };
          } catch (err) {
            console.error('Error fetching user for member', ug, err);
            return {
              name: ug.user_id || 'Unknown',
              wallet: ug.user_id || 'Unknown',
              balance: 0
            };
          }
        }));
        console.log('Final group members array:', members);
        setGroupMembers(members);
        setLoadingMembers(false);
      })();
    } else {
      setGroupMembers([]);
    }
  }, [friendName, isGroup]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        sender: 'You', // In a real app, this would be the user's name
        content: message,
        timestamp: new Date().toISOString(),
      };
      
      setMessages(prevMessages => [...prevMessages, newMessage]);
      setMessage('');
    }
  };

  const handleSettle = () => {
    if (isGroup && currentGroup) {
      setShowSettleModal(true);
    } else {
      console.log('Settlement initiated for individual:', friendName);
      // TODO: Handle individual settlement
    }
  };

  const handleMakeSplit = () => {
    if (isGroup && currentGroup) {
      setShowSplitModal(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full border-l border-gray-200 bg-white">
      <div className="border-b-4 border-black p-5">
        <h2 className="text-xl font-bold">{friendName}</h2>
        {isGroup && (
          <div className="mt-2">
            <h3 className="font-semibold mb-1">Members</h3>
            {loadingMembers ? (
              <div className="text-gray-500 text-sm">Loading members...</div>
            ) : groupMembers.length === 0 ? (
              <div className="text-gray-500 text-sm">No members found.</div>
            ) : (
              <ul className="space-y-1">
                {groupMembers.map((member) => (
                  <li key={member.wallet} className="flex justify-between text-sm">
                    <span>{member.name} <span className="text-gray-400">({member.wallet.slice(0, 6)}...{member.wallet.slice(-4)})</span></span>
                    <span className={`font-mono ${member.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {member.balance >= 0 ? '+' : ''}{member.balance.toFixed(4)} SUI
                    </span>
                  </li>
                ))}
                
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`mb-2 max-w-[30%] ${msg.sender === 'You' ? 'ml-auto' : ''}`}
          >
            <div className={`p-2 rounded-lg border-4 border-black shadow-brutal-sm ${
              msg.sender === 'You' 
                ? 'bg-blue-100' 
                : msg.isPayment 
                  ? 'bg-green-100' 
                  : 'bg-white'
            }`}>
              {msg.sender !== 'You' && !msg.isPayment && (
                <p className="font-bold mb-1">{msg.sender}</p>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 fixed bottom-0 w-3/4 border-t-4 bg-slate-200 pr-10 border-black">
        {isGroup ? (
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={handleSettle}
              className="flex-1 border-4 border-black bg-red-600 hover:bg-red-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              Settle Debts
            </Button>
            <Button 
              onClick={handleMakeSplit}
              className="flex-1 border-4 border-black bg-green-600 hover:bg-green-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              Make Split
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 mb-4">
            <Button 
              onClick={handleSettle}
              className="flex-1 border-4 border-black bg-blue-600 hover:bg-blue-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              Settle
            </Button>
          </div>
        )}
        
        {/* <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input 
            placeholder="Send message..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="border-4 border-black font-semibold"
          />
          <Button 
            type="submit"
            className="border-4 border-black bg-blue-600 hover:bg-blue-700 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all px-10 font-bold py-2"
          >
            Send
          </Button>
        </form> */}
      </div>

      {/* Modals */}
      {isGroup && currentGroup && (
        <>
          <SettleDebtsModal
            isOpen={showSettleModal}
            onClose={() => setShowSettleModal(false)}
            groupId={currentGroup.id}
            groupName={currentGroup.name}
          />
          <MakeSplitModal
            isOpen={showSplitModal}
            onClose={() => setShowSplitModal(false)}
            groupId={currentGroup.id}
            groupName={currentGroup.name}
            groupMembers={groupMembers}
          />
        </>
      )}
    </div>
  );
};

export default ChatWindow;