import React, { useState, useEffect } from 'react';
import { useWallet } from '@suiet/wallet-kit';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Card } from "@/components/ui/card";
import FriendsList from '@/components/FriendsList';
import ChatWindow from '@/components/ChatWindow';
import CreateGroupModal from '@/components/CreateGroupModal';
import Navbar from "../components/ui/Navbar";
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { ApiService, LocalStorageService } from '@/services/api';
import { useNavigate } from 'react-router-dom';

const GROUP_PACKAGE_ID = '0x588c00f96eff4b853c832605083ff60386d6f95f83af05ad48d6875896d49dcb';

const Main = () => {
  const { signAndExecuteTransactionBlock, account } = useWallet();
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroup, setIsGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check if user is authenticated
  useEffect(() => {
    const user = LocalStorageService.getUser();
    const walletAddress = LocalStorageService.getWalletAddress();
    
    if (!user || !walletAddress) {
      console.log('❌ User not authenticated, redirecting to home');
      navigate('/');
      return;
    }
    
    // Verify wallet address matches current connected wallet
    if (account?.address && account.address !== walletAddress) {
      console.log('❌ Wallet address mismatch, clearing storage and redirecting');
      LocalStorageService.clearUserData();
      navigate('/');
      return;
    }
    
    console.log('✅ User authenticated:', user);
  }, [account, navigate]);

  const handleFriendSelect = (friendName: string, isGroupChat: boolean = false) => {
    setSelectedFriend(friendName);
    setIsGroup(isGroupChat);
  };

  const handleCreateGroup = async (groupName: string) => {
    try {
      setGroupError(null);
      const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
      if (!account?.address) throw new Error('Wallet not connected');

      const txb = new TransactionBlock();
      const nameBytes = Array.from(new TextEncoder().encode(groupName));
      txb.moveCall({
        target: `${GROUP_PACKAGE_ID}::payment_splitter::create_group`,
        arguments: [txb.pure(nameBytes, 'vector<u8>')],
      });
      txb.setGasBudget(20000000); // 0.02 SUI - increased for safety

      // 1. Run the transaction
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

      // 3. Extract group ID from transaction result
      let groupId: string | null = null;

      // ========================================
      // PRIMARY METHOD: Query transaction by digest to get shared objects
      // ========================================
      try {
        const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });
        console.log("🔍 Querying transaction by digest:", result.digest);
        
        const transactionDetails = await suiClient.getTransactionBlock({
          digest: result.digest,
          options: {
            showEffects: true,
            showObjectChanges: true,
            showEvents: true,
            showInput: true,
            showRawInput: false,
          },
        });
        
        console.log("Full transaction details:", transactionDetails);

        // Check for created objects in the full transaction details
        if (transactionDetails.objectChanges) {
          const createdObjects = transactionDetails.objectChanges.filter(
            (change: any) => change.type === "created"
          );
          console.log("✅ Created objects from full transaction:", createdObjects);
          
          if (createdObjects.length > 0) {
            // Look for the group object (might be a shared object)
            for (const obj of createdObjects) {
              console.log("Created object:", obj);
              const objectChange = obj as any;
              // Check if this is our group object
              if (objectChange.objectType && (objectChange.objectType.includes("Group") || objectChange.objectType.includes("payment_splitter"))) {
                groupId = objectChange.objectId;
                console.log("🎉 Found Group object from transaction details:", groupId);
                break;
              }
            }
            
            // If no Group type found, use the first created object
            if (!groupId && (createdObjects[0] as any).objectId) {
              groupId = (createdObjects[0] as any).objectId;
              console.log("🎉 Using first created object as group ID:", groupId);
            }
          }
        }

        // Check effects.created for shared objects
        if (!groupId && transactionDetails.effects?.created) {
          console.log("✅ Checking effects.created:", transactionDetails.effects.created);
          
          for (const created of transactionDetails.effects.created) {
            console.log("Created object from effects:", created);
            if ((created as any).reference?.objectId) {
              groupId = (created as any).reference.objectId;
              console.log("🎉 Found object ID from effects.created:", groupId);
              break;
            } else if ((created as any).objectId) {
              groupId = (created as any).objectId;
              console.log("🎉 Found object ID from effects.created:", groupId);
              break;
            }
          }
        }

        // Check events for group creation
        if (!groupId && transactionDetails.events) {
          console.log("✅ Checking events for group creation:", transactionDetails.events);
          
          for (const event of transactionDetails.events) {
            console.log("Event:", event);
            if (event.parsedJson && typeof event.parsedJson === 'object') {
              const eventData = event.parsedJson as Record<string, any>;
              if (eventData.group_id || eventData.id || eventData.object_id) {
                groupId = eventData.group_id || eventData.id || eventData.object_id;
                console.log("🎉 Found group ID from events:", groupId);
                break;
              }
            }
          }
        }

      } catch (error) {
        console.error("❌ Error querying transaction details:", error);
      }

      // ========================================
      // FALLBACK METHODS (from wallet response)
      // ========================================
      
      // Method 1: Check objectChanges for created objects
      if (!groupId) {
        console.log('🔍 Fallback Method 1: Checking wallet objectChanges...');
        if (result.objectChanges && result.objectChanges.length > 0) {
          console.log('ObjectChanges found:', result.objectChanges);
          const createdObjects = result.objectChanges.filter((change: any) => change.type === 'created');
          console.log('Created objects:', createdObjects);
          
          if (createdObjects.length > 0) {
            // Look for the Group object (should be the shared object)
            const groupObject = createdObjects.find((obj: any) => 
              obj.objectType?.includes('Group') || obj.objectType?.includes('payment_splitter')
            );
            
            if (groupObject) {
              groupId = (groupObject as any).objectId;
              console.log('✅ Found group ID from objectChanges:', groupId);
            } else if (createdObjects.length === 1) {
              // If only one object was created, it's likely our group
              groupId = (createdObjects[0] as any).objectId;
              console.log('✅ Found group ID (single created object):', groupId);
            }
          }
        } else {
          console.log('❌ No objectChanges found');
        }
      }

      // Method 2: Check effects.created if objectChanges didn't work
      if (!groupId && result.effects?.created) {
        console.log('🔍 Fallback Method 2: Checking wallet effects.created...');
        console.log('Effects.created:', result.effects.created);
        
        if (result.effects.created.length > 0) {
          // Take the first created object (should be our group)
          const createdRef = result.effects.created[0];
          groupId = (createdRef as any).reference?.objectId || (createdRef as any).objectId;
          console.log('✅ Found group ID from effects.created:', groupId);
        } else {
          console.log('❌ No created objects in effects');
        }
      }

      // Method 3: Check events for group creation
      if (!groupId && result.events) {
        console.log('🔍 Fallback Method 3: Checking wallet events...');
        console.log('Events:', result.events);
        
        // Look for events that might contain the group ID
        for (const event of result.events) {
          if (event.type?.includes('payment_splitter') || event.type?.includes('Group')) {
            console.log('Found relevant event:', event);
            // Try to extract object ID from event data
            if (event.parsedJson && typeof event.parsedJson === 'object') {
              const eventData = event.parsedJson as any;
              if (eventData.group_id) {
                groupId = eventData.group_id;
                console.log('✅ Found group ID from event:', groupId);
                break;
              }
            }
          }
        }
        
        if (!groupId) {
          console.log('❌ No group ID found in events');
        }
      }

      // Final result
      if (groupId) {
        console.log('🎉 Successfully extracted group ID:', groupId);
        
        // Save group to database
        try {
          const savedGroup = await ApiService.createGroup(groupId, groupName, account.address);
          console.log('✅ Group saved to database:', savedGroup);
        } catch (error) {
          console.error('❌ Failed to save group to database:', error);
        }
      } else {
        console.log('⚠️ Group creation transaction succeeded, but could not extract group ID');
        console.log('Transaction was successful - group exists but ID extraction failed');
      }
      setIsGroupModalOpen(false);
      handleFriendSelect(groupName, true);
    } catch (error) {
      console.error('Group creation failed:', error);
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