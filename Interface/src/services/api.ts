const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export interface User {
  id: number;
  wallet_address: string;
  name: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  owner_address: string;
  created_at: string;
}

export interface Expense {
  id: string;
  group_id: string;
  description: string;
  payer_address: string;
  amount: number;
  created_at: string;
}

export interface Settlement {
  id: string;
  group_id: string;
  from_address: string;
  to_address: string;
  amount: number;
  note?: string;
  created_at: string;
}

export interface ExpenseParticipant {
  id: number;
  expense_id: string;
  participant_address: string;
  share_amount: number;
}

export interface ChatGroup {
  id: number;
  name: string;
  description?: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  group_id: number;
  sender_user_id: string;
  content: string;
  message_type: string;
  sent_at: string;
  parent_message_id?: number;
  users?: {
    id: string;
    name: string;
    wallet_address: string;
  };
  parent_message?: {
    id: number;
    content: string;
    sender_user_id: string;
    users?: {
      id: string;
      name: string;
      wallet_address: string;
    };
  };
}

export interface DirectChat extends ChatGroup {
  other_user?: {
    id: string;
    name: string;
    wallet_address: string;
  };
}

export class ApiService {
  // User APIs
  static async createUser(walletAddress: string, name: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        name: name
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create user');
    }

    return response.json();
  }

  static async getUserByWallet(walletAddress: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${walletAddress}`);
      
      if (response.status === 404) {
        return null; // User doesn't exist
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  static async updateUser(walletAddress: string, name: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${walletAddress}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update user');
    }

    return response.json();
  }

  static async getUserById(uuid: string): Promise<User | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/by-id/${uuid}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Failed to fetch user by id');
      }
      return response.json();
    } catch (error) {
      console.error('Error fetching user by id:', error);
      return null;
    }
  }

  // Group APIs
  static async createGroup(groupId: string, name: string, ownerAddress: string): Promise<Group> {
    const response = await fetch(`${API_BASE_URL}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: groupId,
        name: name,
        owner_address: ownerAddress
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create group');
    }

    return response.json();
  }

  static async getGroupById(groupId: string): Promise<Group | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/groups/${groupId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch group');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching group:', error);
      return null;
    }
  }

  static async getUserGroups(walletAddress: string): Promise<Group[]> {
    try {
      // Get owned groups (where user is the owner)
      const ownedResponse = await fetch(`${API_BASE_URL}/groups?owner=${walletAddress}`);
      
      if (!ownedResponse.ok) {
        throw new Error('Failed to fetch owned groups');
      }
      
      const ownedGroups: Group[] = await ownedResponse.json();
      
      // Get user ID from wallet address to find member groups
      const user = await this.getUserByWallet(walletAddress);
      if (!user) {
        console.log('User not found for wallet address:', walletAddress);
        return ownedGroups; // Return only owned groups if user not found
      }
      
      // Get groups where user is a member
      const memberGroupsResponse = await fetch(`${API_BASE_URL}/user_groups/${user.id}`);
      
      if (!memberGroupsResponse.ok) {
        console.error('Failed to fetch member groups');
        return ownedGroups; // Return only owned groups on error
      }
      
      const memberGroupsData = await memberGroupsResponse.json();
      
      // If no member groups, return only owned groups
      if (!memberGroupsData || memberGroupsData.length === 0) {
        return ownedGroups;
      }
      
      // For each member group, get the full group details
      const memberGroupIds = memberGroupsData.map((item: any) => item.group_id);
      const memberGroups: Group[] = [];
      
      for (const groupId of memberGroupIds) {
        const group = await this.getGroupById(groupId);
        if (group) {
          memberGroups.push(group);
        }
      }
      
      // Combine owned and member groups, filtering out duplicates
      const allGroups = [...ownedGroups];
      
      // Add member groups that aren't already in owned groups
      memberGroups.forEach(memberGroup => {
        if (!allGroups.some(g => g.id === memberGroup.id)) {
          allGroups.push(memberGroup);
        }
      });
      
      return allGroups;
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  }

  // Add members to group
  static async addMembersToGroup(groupId: string, memberWallets: string[]): Promise<any> {
    // For each wallet, get user_id, then add to user_groups
    const results = [];
    for (const wallet of memberWallets) {
      console.log(`[ApiService] Attempting to add member to group in DB:`, { groupId, wallet });
      // Get user by wallet address
      const user = await this.getUserByWallet(wallet);
      if (!user) {
        console.error(`[ApiService] User not found for wallet: ${wallet}`);
        results.push({ wallet, error: 'User not found' });
        continue;
      }
      // Add to user_groups
      try {
        const response = await fetch(`${API_BASE_URL}/user_groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, group_id: groupId })
        });
        if (!response.ok) {
          const error = await response.json();
          console.error(`[ApiService] Failed to add to group in DB:`, { wallet, error });
          results.push({ wallet, error: error.error || 'Failed to add to group' });
        } else {
          const data = await response.json();
          console.log(`[ApiService] Successfully added to group in DB:`, { wallet, data });
          results.push({ wallet, success: true });
        }
      } catch (err) {
        console.error(`[ApiService] Exception adding to group in DB:`, { wallet, err });
        results.push({ wallet, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    return results;
  }

  // Friends APIs
  static async getUserFriends(userId: string): Promise<User[]> {
    try {
      // Get friend IDs for the user
      const response = await fetch(`${API_BASE_URL}/friends/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user friends');
      }

      const friendsData = await response.json();
      
      if (!friendsData || friendsData.length === 0) {
        return [];
      }

      // Get full user details for each friend
      const friends: User[] = [];
      
      for (const friendItem of friendsData) {
        const friend = await this.getUserById(friendItem.friend_id);
        if (friend) {
          friends.push(friend);
        }
      }
      
      return friends;
    } catch (error) {
      console.error('Error fetching user friends:', error);
      return [];
    }
  }

  static async addFriend(userId: string, friendId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/friends`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        friend_id: friendId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add friend');
    }

    return response.json();
  }

  static async removeFriend(userId: string, friendId: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/friends`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        friend_id: friendId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove friend');
    }

    return response.json();
  }

  // Expense APIs
  static async createExpense(expense: Omit<Expense, 'created_at'>): Promise<Expense> {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expense),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create expense');
    }

    return response.json();
  }

  static async getGroupExpenses(groupId: string): Promise<Expense[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/expenses/group/${groupId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch group expenses');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching group expenses:', error);
      return [];
    }
  }

  static async addExpenseParticipants(expenseId: string, participants: Array<{participant_address: string, share_amount: number}>): Promise<any> {
    const results = [];
    for (const participant of participants) {
      try {
        const response = await fetch(`${API_BASE_URL}/expense_participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expense_id: expenseId,
            participant_address: participant.participant_address,
            share: participant.share_amount // Backend expects 'share' not 'share_amount'
          })
        });
        if (!response.ok) {
          const error = await response.json();
          results.push({ participant, error: error.error || 'Failed to add participant' });
        } else {
          const data = await response.json();
          results.push({ participant, success: true, data });
        }
      } catch (err) {
        results.push({ participant, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }
    return results;
  }

  // Settlement APIs
  static async createSettlement(settlement: Omit<Settlement, 'created_at'>): Promise<Settlement> {
    const response = await fetch(`${API_BASE_URL}/settlements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settlement),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create settlement');
    }

    return response.json();
  }

  static async getGroupSettlements(groupId: string): Promise<Settlement[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/settlements/group/${groupId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch group settlements');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching group settlements:', error);
      return [];
    }
  }

  // Chat APIs
  
  // Chat Groups
  static async createChatGroup(name: string, description: string, createdByUserId: string): Promise<ChatGroup> {
    const response = await fetch(`${API_BASE_URL}/chat/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        created_by_user_id: createdByUserId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create chat group');
    }

    return response.json();
  }

  // Create or get chat group for existing user group (expense group)
  static async createChatGroupFromUserGroup(userGroupId: string, userId: string): Promise<ChatGroup> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/from-user-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_group_id: userGroupId,
        user_id: userId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create/get chat group from user group');
    }

    return response.json();
  }

  static async getChatGroup(groupId: number): Promise<ChatGroup | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat group');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching chat group:', error);
      return null;
    }
  }

  static async getUserChatGroups(userId: string): Promise<ChatGroup[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/groups/user/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user chat groups');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching user chat groups:', error);
      return [];
    }
  }

  static async updateChatGroup(groupId: number, name: string, description?: string): Promise<ChatGroup> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update chat group');
    }

    return response.json();
  }

  static async deleteChatGroup(groupId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete chat group');
    }
  }

  // Chat Group Members
  static async addChatGroupMember(groupId: number, userId: string, role: string = 'member'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/members`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        role
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add chat group member');
    }

    return response.json();
  }

  static async getChatGroupMembers(groupId: number): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/members`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat group members');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching chat group members:', error);
      return [];
    }
  }

  static async removeChatGroupMember(groupId: number, userId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove chat group member');
    }
  }

  // Chat Messages
  static async sendChatMessage(
    groupId: number, 
    senderUserId: string, 
    content: string, 
    messageType: string = 'text',
    parentMessageId?: number
  ): Promise<ChatMessage> {
    const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_user_id: senderUserId,
        content,
        message_type: messageType,
        parent_message_id: parentMessageId
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return response.json();
  }

  static async getChatMessages(
    groupId: number, 
    limit: number = 50, 
    offset: number = 0, 
    beforeId?: number
  ): Promise<ChatMessage[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      
      if (beforeId) {
        params.append('before_id', beforeId.toString());
      }

      const response = await fetch(`${API_BASE_URL}/chat/groups/${groupId}/messages?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat messages');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
  }

  // Direct Chats (1-to-1)
  static async createOrGetDirectChat(user1Id: string, user2Id: string): Promise<ChatGroup> {
    const response = await fetch(`${API_BASE_URL}/chat/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user1_id: user1Id,
        user2_id: user2Id
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create/get direct chat');
    }

    return response.json();
  }

  static async getUserDirectChats(userId: string): Promise<DirectChat[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/direct/user/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user direct chats');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching user direct chats:', error);
      return [];
    }
  }
}

// Local storage utilities
export class LocalStorageService {
  private static USER_KEY = 'supay_user';
  private static WALLET_KEY = 'supay_wallet';

  static saveUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  static getUser(): User | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }

  static saveWalletAddress(address: string): void {
    localStorage.setItem(this.WALLET_KEY, address);
  }

  static getWalletAddress(): string | null {
    return localStorage.getItem(this.WALLET_KEY);
  }

  static clearUserData(): void {
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.WALLET_KEY);
  }

  static isUserLoggedIn(): boolean {
    return this.getUser() !== null && this.getWalletAddress() !== null;
  }
}


