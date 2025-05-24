import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiService, ChatMessage, ChatGroup, DirectChat, LocalStorageService } from '@/services/api';
import SuiService, { NetBalance } from '@/services/suiService';
import SettleDebtsModal from './SettleDebtsModal';
import MakeSplitModal from './MakeSplitModal';
import PayModal from './PayModal';

interface ChatWindowProps {
  friendName: string;
  isGroup: boolean;
  friendWalletAddress?: string; // For friend payments
}

const ChatWindow: React.FC<ChatWindowProps> = ({ friendName, isGroup, friendWalletAddress }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<{name: string, wallet: string, balance: number, netBalance?: NetBalance}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentGroup, setCurrentGroup] = useState<any>(null);
  const [currentChatGroup, setCurrentChatGroup] = useState<ChatGroup | DirectChat | null>(null);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get current user on component mount
  useEffect(() => {
    const user = LocalStorageService.getUser();
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  // Initialize chat when friendName changes
  useEffect(() => {
    initializeChat();
  }, [friendName, isGroup, currentUser]);

  const initializeChat = async () => {
    if (!currentUser) return;

    try {
      if (isGroup) {
        // Handle group chat
        await initializeGroupChat();
      } else {
        // Handle direct chat (1-to-1)
        await initializeDirectChat();
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  const initializeGroupChat = async () => {
    if (!currentUser) return;

    setLoadingMessages(true);
    try {
      // First get the expense groups (existing functionality)
      const walletAddress = localStorage.getItem('supay_wallet');
      let expenseGroup = null;
      if (walletAddress) {
        const groups = await ApiService.getUserGroups(walletAddress);
        expenseGroup = groups.find((g: any) => g.name === friendName);
        setCurrentGroup(expenseGroup);
      }

      // If we have an expense group, create/get the corresponding chat group
      let chatGroup = null;
      if (expenseGroup) {
        // Use the new integration endpoint to create or get chat group for this expense group
        chatGroup = await ApiService.createChatGroupFromUserGroup(expenseGroup.id, currentUser.id);
      } else {
        // Fallback: look for existing chat groups
        const chatGroups = await ApiService.getUserChatGroups(currentUser.id);
        chatGroup = chatGroups.find(g => g.name === friendName);
        
        if (!chatGroup) {
          // Create new standalone chat group
          chatGroup = await ApiService.createChatGroup(
            friendName,
            `Chat for ${friendName} group`,
            currentUser.id
          );
        }
      }

      setCurrentChatGroup(chatGroup);

      // Load messages
      const chatMessages = await ApiService.getChatMessages(chatGroup.id);
      setMessages(chatMessages);

      // Fetch group members for balance display
      await fetchGroupMembers();
    } catch (error) {
      console.error('Error initializing group chat:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const initializeDirectChat = async () => {
    if (!currentUser || !friendWalletAddress) return;

    setLoadingMessages(true);
    try {
      // Get friend user by wallet address
      const friend = await ApiService.getUserByWallet(friendWalletAddress);
      if (!friend) {
        console.error('Friend not found');
        return;
      }

      // Create or get direct chat
      const directChat = await ApiService.createOrGetDirectChat(currentUser.id.toString(), friend.id.toString());
      setCurrentChatGroup({
        ...directChat,
        other_user: {
          id: friend.id.toString(),
          name: friend.name,
          wallet_address: friend.wallet_address
        }
      });

      // Load messages
      const chatMessages = await ApiService.getChatMessages(directChat.id);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Error initializing direct chat:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Extract group member fetching logic into a separate function for reuse
  const fetchGroupMembers = async () => {
    if (!isGroup) {
      setGroupMembers([]);
      return;
    }

    setLoadingMembers(true);
    try {
      // 1. Get group by name
      const walletAddress = localStorage.getItem('supay_wallet');
      let group = null;
      if (walletAddress) {
        // This will now fetch both owned groups and groups the user is a member of
        const groups = await ApiService.getUserGroups(walletAddress);
        console.log('Fetched all groups (owned and member) for wallet', walletAddress, groups); // LOG
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
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      const groupMembersUrl = `${backendUrl}/user_groups/group/${group.id}`;
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
              if (netBalance.is_positive) {
                displayBalance = netBalance.net_amount; // They are owed money (positive)
              } else {
                displayBalance = -netBalance.debt_amount; // They owe money (negative)
              }
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
    } catch (error) {
      console.error('Error fetching group members:', error);
      setGroupMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchGroupMembers();
  }, [friendName, isGroup]);

  // Refresh function to be called after transactions
  const refreshData = () => {
    console.log('Refreshing data after transaction...');
    fetchGroupMembers();
  };

  useEffect(() => {
    // The extracted function already handles this logic
  }, [friendName, isGroup]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentChatGroup || !currentUser) return;

    try {
      const sentMessage = await ApiService.sendChatMessage(
        currentChatGroup.id,
        currentUser.id.toString(),
        message.trim()
      );

      // Add the message to local state immediately for better UX
      setMessages(prevMessages => [...prevMessages, sentMessage]);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      // Could show a toast notification here
    }
  };

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!currentChatGroup) return;

    const pollInterval = setInterval(async () => {
      try {
        const latestMessages = await ApiService.getChatMessages(currentChatGroup.id);
        if (latestMessages.length > messages.length) {
          setMessages(latestMessages);
        }
      } catch (error) {
        console.error('Error polling for messages:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentChatGroup, messages.length]);

  const handleSettle = () => {
    console.log('handleSettle called - isGroup:', isGroup, 'currentGroup:', currentGroup);
    if (isGroup && currentGroup) {
      // Make sure we have a valid groupId before opening the modal
      if (!currentGroup.id) {
        console.error('Cannot open settlement modal: Missing group ID');
        return;
      }
      console.log('Opening settle modal for group:', currentGroup.name, 'with ID:', currentGroup.id);
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
    <div className="flex-1 flex flex-col h-full border border-gray-200 bg-white">
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
        {loadingMessages ? (
          <div className="text-center text-gray-500">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((msg) => {
            const isCurrentUser = currentUser && msg.sender_user_id === currentUser.id.toString();
            const senderName = msg.users?.name || 'Unknown User';
            
            return (
              <div 
                key={msg.id}
                className={`mb-3 max-w-[70%] ${isCurrentUser ? 'ml-auto' : ''}`}
              >
                <div className={`p-3 rounded-lg border-4 border-black shadow-brutal-sm ${
                  isCurrentUser 
                    ? 'bg-blue-100' 
                    : msg.message_type === 'payment'
                      ? 'bg-green-100' 
                      : 'bg-white'
                }`}>
                  {!isCurrentUser && (
                    <p className="font-bold mb-1 text-sm">{senderName}</p>
                  )}
                  <p>{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(msg.sent_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
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
              onClick={() => setShowPayModal(true)}
              className="flex-1 border-4 border-black bg-green-600 hover:bg-green-700 text-white shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
              disabled={!friendWalletAddress}
            >
              Pay
            </Button>
          </div>
        )}
        
        <form onSubmit={handleSendMessage} className="flex gap-2">
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
        </form> 
      </div>

      {/* Modals */}
      {isGroup && currentGroup && (
        <>
          {/* Check if we have a valid group ID before rendering the modal */}
          {currentGroup.id ? (
            <>
              <SettleDebtsModal
                isOpen={showSettleModal}
                onClose={() => {
                  console.log('Closing SettleDebtsModal');
                  setShowSettleModal(false);
                }}
                groupId={currentGroup.id}
                groupName={currentGroup.name}
                onTransactionSuccess={refreshData}
              />
              <MakeSplitModal
                isOpen={showSplitModal}
                onClose={() => setShowSplitModal(false)}
                groupId={currentGroup.id}
                groupName={currentGroup.name}
                groupMembers={groupMembers}
                onTransactionSuccess={refreshData}
              />
            </>
          ) : (
            console.error('Cannot render modals: Missing group ID for group', currentGroup.name)
          )}
        </>
      )}

      {/* Pay Modal for friends */}
      {!isGroup && friendWalletAddress && (
        <PayModal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          friendName={friendName}
          friendWalletAddress={friendWalletAddress}
          onTransactionSuccess={refreshData}
        />
      )}
    </div>
  );
};

export default ChatWindow;