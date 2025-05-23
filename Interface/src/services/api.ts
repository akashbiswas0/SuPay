const API_BASE_URL = 'http://localhost:3000';

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
      const response = await fetch(`${API_BASE_URL}/groups?owner=${walletAddress}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user groups');
      }

      return response.json();
    } catch (error) {
      console.error('Error fetching user groups:', error);
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
