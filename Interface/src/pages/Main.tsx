import React, { useState } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Card } from "@/components/ui/card";
import FriendsList from '@/components/FriendsList';
import ChatWindow from '@/components/ChatWindow';
import CreateGroupModal from '@/components/CreateGroupModal';
import Navbar from "../components/ui/Navbar";

const GROUP_PACKAGE_ID = '0x588c00f96eff4b853c832605083ff60386d6f95f83af05ad48d6875896d49dcb';

const Main = () => {
  const { signAndExecuteTransactionBlock } = useWallet();
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const handleFriendSelect = (friendName: string, isGroupChat: boolean = false) => {
    setSelectedFriend(friendName);
    setIsGroup(isGroupChat);
  };

  const handleCreateGroup = async (groupName: string) => {
    try {
      setGroupError(null);
      
      const txb = new TransactionBlock();
      
      // Your Move function expects vector<u8> - let's try the most direct approach
      const nameBytes = Array.from(new TextEncoder().encode(groupName));
      
      console.log('Group name:', groupName);
      console.log('Name bytes:', nameBytes);
      console.log('Package ID:', GROUP_PACKAGE_ID);
      console.log('Target function:', `${GROUP_PACKAGE_ID}::payment_splitter::create_group`);
      
      txb.moveCall({
        target: `${GROUP_PACKAGE_ID}::payment_splitter::create_group`,
        arguments: [
          txb.pure(nameBytes, 'vector<u8>'),
        ],
      });



      // Set gas budget
      txb.setGasBudget(20000000); // 0.02 SUI - increased for safety

      const result = await signAndExecuteTransactionBlock({
        transactionBlock: txb,
        options: {
          showEvents: true,
          showObjectChanges: true,
          showEffects: true,
          showInput: true,
          showRawInput: true,
        },
      });

      console.log('Full transaction result:', JSON.stringify(result, null, 2));
      console.log('Object changes:', result.objectChanges);
      console.log('Events:', result.events);
      console.log('Effects:', result.effects);

      let groupId = null;

      // Method 1: Look for created objects in objectChanges
      if (result.objectChanges && result.objectChanges.length > 0) {
        console.log('Checking object changes...');
        result.objectChanges.forEach((change, index) => {
          console.log(`Change ${index}:`, change);
        });

        const createdObject = result.objectChanges.find(
          (change) => 
            change.type === 'created' &&
            (change.objectType?.includes('Group') || 
             change.objectType?.includes('group'))
        );

        if (createdObject && 'objectId' in createdObject) {
          groupId = createdObject.objectId;
          console.log('Found created group ID from objectChanges:', groupId);
        }
      }

      // Method 2: Look in events
      if (!groupId && result.events && result.events.length > 0) {
        console.log('Checking events...');
        result.events.forEach((event, index) => {
          console.log(`Event ${index}:`, event);
        });

        const groupEvent = result.events.find(
          (event) => 
            event.type?.includes('Group') || 
            event.type?.includes('group') ||
            event.parsedJson?.group_id
        );

        if (groupEvent) {
          console.log('Found group event:', groupEvent);
          // Extract group ID from event if available
          if (groupEvent.parsedJson?.group_id) {
            groupId = groupEvent.parsedJson.group_id;
          } else if (groupEvent.parsedJson?.id) {
            groupId = groupEvent.parsedJson.id;
          }
        }
      }

      // Method 3: Look in transaction effects for created objects
      if (!groupId && result.effects?.created && result.effects.created.length > 0) {
        console.log('Checking transaction effects created objects...');
        result.effects.created.forEach((created, index) => {
          console.log(`Created object ${index}:`, created);
        });

        const createdGroup = result.effects.created.find(
          (created) => 
            created.reference?.objectId && (
              created.reference.objectType?.includes('Group') ||
              created.reference.objectType?.includes('group')
            )
        );

        if (createdGroup?.reference?.objectId) {
          groupId = createdGroup.reference.objectId;
          console.log('Found created group ID from effects:', groupId);
        }
      }

      // Method 4: If still not found, just take the first created object
      if (!groupId && result.objectChanges && result.objectChanges.length > 0) {
        const firstCreated = result.objectChanges.find(change => change.type === 'created');
        if (firstCreated && 'objectId' in firstCreated) {
          groupId = firstCreated.objectId;
          console.log('Using first created object as group ID:', groupId);
        }
      }

      if (groupId) {
        console.log('Successfully created group with ID:', groupId);
      } else {
        console.log('Group creation transaction succeeded, but could not locate group ID');
        // Don't throw error, just proceed - the group was likely created successfully
      }

      setIsGroupModalOpen(false);
      handleFriendSelect(groupName, true);
      
    } catch (error) {
      console.error('Group creation failed:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to create group';
      
      if (error instanceof Error) {
        if (error.message.includes('VMVerificationOrDeserializationError')) {
          errorMessage = 'Invalid transaction parameters. Please check the smart contract function signature.';
        } else if (error.message.includes('InsufficientGas')) {
          errorMessage = 'Insufficient gas to complete the transaction.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setGroupError(errorMessage);
      throw error;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <header className="h-16 border-b-4 pb-20 border-black bg-white justify-between">
        <Navbar />
      </header>
      
      <div className="flex flex-1 overflow-hidden mt">
        <FriendsList 
          onFriendSelect={handleFriendSelect}
          onCreateGroup={() => setIsGroupModalOpen(true)}
          selectedFriend={selectedFriend}
        />
        
        {selectedFriend ? (
          <ChatWindow 
            friendName={selectedFriend}
            isGroup={isGroup}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <Card className="p-6 text-center max-w-md shadow-brutal border-4 border-black bg-white">
              <h2 className="text-2xl font-bold mb-2">Welcome to SuPay</h2>
              <p className="text-gray-700">Select a friend or group to start chatting, or create a new group.</p>
            </Card>
          </div>
        )}
      </div>
      
      <CreateGroupModal 
        isOpen={isGroupModalOpen}
        onClose={() => {
          setIsGroupModalOpen(false);
          setGroupError(null);
        }}
        onCreateGroup={handleCreateGroup}
        error={groupError}
      />
    </div>
  );
};

export default Main;