import { apiClient } from './api';
import { User } from '../types';

// User API interfaces
export interface UpdateUserRequest {
  tag?: string;
  email?: string;
  address?: string;
}

export interface UserResponse {
  id: string;
  tag: string;
  email: string;
  address: string;
  is_verified: boolean;
  kyc_status: string;
  created_at: string;
  role?: string;
}

// User API functions
export const userApi = {
  // Get all users (admin only)
  async getAllUsers(): Promise<UserResponse[]> {
    try {
      const response = await apiClient.get<{ users: UserResponse[] }>('/users');
      return response.users;
    } catch (error) {
      console.error('Failed to get users:', error);
      throw error;
    }
  },

  // Get user by ID
  async getUserById(id: string): Promise<UserResponse> {
    try {
      const response = await apiClient.get<{ user: UserResponse }>(`/users/${id}`);
      return response.user;
    } catch (error) {
      console.error('Failed to get user:', error);
      throw error;
    }
  },

  // Update user
  async updateUser(id: string, userData: UpdateUserRequest): Promise<UserResponse> {
    try {
      const response = await apiClient.put<{ user: UserResponse }>(`/users/${id}`, userData);
      return response.user;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  },

  // Delete user (admin only)
  async deleteUser(id: string): Promise<void> {
    try {
      await apiClient.delete(`/users/${id}`);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }
};

// Helper function to convert backend user to frontend User format
export const mapBackendUserToUser = (backendUser: UserResponse): User => {
  return {
    id: backendUser.id,
    tag: backendUser.tag,
    address: backendUser.address,
    is_verified: backendUser.is_verified,
    created_at: backendUser.created_at,
    totalDeposits: 0, // These would need to be calculated from transactions
    totalWithdrawals: 0
  };
};
