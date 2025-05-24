import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axios from 'axios';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFriend: (friendName: string, friendId: string) => void; // Updated to pass both name and ID
}

const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  onAddFriend
}) => {
  const [walletAddress, setWalletAddress] = useState('');
  const [fetchingUser, setFetchingUser] = useState(false);
  const [userId, setUserId] = useState(''); // Store user ID separately
  const [userName, setUserName] = useState('');
  const [userFound, setUserFound] = useState(false);
  const [error, setError] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isAddingFriend, setIsAddingFriend] = useState(false); // New state for POST request loading

  // Auto-fetch user when wallet address changes (with debounce)
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    if (!walletAddress.trim()) {
      setUserId('');
      setUserName('');
      setUserFound(false);
      setError('');
      return;
    }

    const timer = setTimeout(() => {
      fetchUserByWallet(walletAddress.trim());
    }, 500);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [walletAddress]);

  const fetchUserByWallet = async (wallet: string) => {
    setFetchingUser(true);
    setUserFound(false);
    setError('');

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
      console.log('Auto-fetching user for wallet:', wallet);
      const response = await axios.get(`${BACKEND_URL}/users/${wallet}`);
      console.log('User data:', response.data);
      const userData = response.data;

      setUserId(userData.id);
      setUserName(userData.name || 'Unknown User');
      setUserFound(true);

    } catch (err) {
      console.error('Error fetching user:', err);
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 404) {
          setError('User not found with this wallet address');
        } else if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else {
          setError(`Error: ${err.response?.status || 'Unknown'}`);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch user');
      }
      setUserId('');
      setUserName('');
      setUserFound(false);
    } finally {
      setFetchingUser(false);
    }
  };

  const handleAddFriend = async () => {
    if (!userFound || !userId || !userName) {
      setError("Cannot add friend, user data is missing.");
      return;
    }

    const loggedInUserSupayData = localStorage.getItem('supay_user');
    if (!loggedInUserSupayData) {
      setError("Could not find logged-in user ID. Please log in again.");
      return;
    }

    let loggedInUserId;
    try {
      // Assuming supay_user stored in local storage is a JSON string with an 'id' field
      const supayUserObject = JSON.parse(loggedInUserSupayData);
      loggedInUserId = supayUserObject?.id;

      if (!loggedInUserId) {
        setError("Logged-in user ID is invalid. Please log in again.");
        return;
      }
    } catch (e) {
      console.error("Error parsing supay_user from localStorage:", e);
      setError("Error retrieving logged-in user ID. Please ensure it's stored correctly.");
      return;
    }

    setIsAddingFriend(true);
    setError('');

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
      const response = await axios.post(`${BACKEND_URL}/friends`, {
        user_id: loggedInUserId, // The logged-in user ID
        friend_id: userId // The ID of the user being added as friend
      });

      console.log('Friend added successfully:', response.data);
      
      // Create/ensure direct chat exists between the two users
      try {
        const { ApiService } = await import('../services/api');
        await ApiService.createOrGetDirectChat(loggedInUserId, userId);
        console.log('Direct chat created/retrieved for new friendship');
      } catch (chatError) {
        console.warn('Warning: Could not create direct chat:', chatError);
        // Don't fail the friendship process if chat creation fails
      }

      onAddFriend(userName, userId); // Call onAddFriend with friend name and ID
      handleClose(); // Close modal on success
      
      // Reload the page to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (err) {
      console.error('Error adding friend:', err);
      if (axios.isAxiosError(err)) {
        if (err.response?.data?.error) {
          setError(`Failed to add friend: ${err.response.data.error}`);
        } else {
          setError(`Failed to add friend: ${err.message}`);
        }
      } else {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while adding friend.');
      }
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleClose = () => {
    onClose();
    setWalletAddress('');
    setUserId('');
    setUserName('');
    setUserFound(false);
    setFetchingUser(false);
    setIsAddingFriend(false); // Reset adding friend state
    setError('');
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-md border-4 border-black shadow-brutal bg-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold border-b-4 border-black pb-2">Add Friend</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Input
              placeholder="Enter wallet address"
              className="border-4 border-black"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled={fetchingUser || isAddingFriend}
            />

            {fetchingUser && (
              <div className="text-sm text-blue-600 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                Searching for user...
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 border-4 border-red-500 bg-red-50 text-red-700 font-medium">
              {error}
            </div>
          )}

          {userFound && userName && !error && ( // Ensure no error is shown when user is found
            <div className="p-4 border-4 border-green-500 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-green-700 font-medium">User Found!</span>
              </div>
              <div className="text-lg font-bold text-green-800">
                {userName}
              </div>
              <div className="text-xs text-green-600 mt-1">
                Ready to add as friend
              </div>
            </div>
          )}

          <Button
            onClick={handleAddFriend}
            disabled={!userFound || fetchingUser || isAddingFriend}
            className="w-full border-4 border-black bg-blue-600 hover:bg-blue-700 shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingFriend ? 'Adding Friend...' : fetchingUser ? 'Searching...' : userFound ? `Add ${userName}` : 'Add Friend'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;