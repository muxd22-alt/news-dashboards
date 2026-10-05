import { create } from 'zustand';

export type UserType = 'client' | 'vendor' | 'admin' | 'viewer' | 'editor' | null;

export interface SubscriptionInfo {
  status: 'trial' | 'active' | 'expired' | 'pending_transfer' | 'pending_approval';
  endsAt: number; // Storing as timestamp milliseconds directly for simplicity, or we can use any
}

export interface UserProfile {
  id: string;
  phone: string;
  name: string;
  email?: string;
  photoURL?: string;
  type: UserType;
  city?: string;
  crNumber?: string;
  serviceCategories?: string[];
  website?: string;
  portfolio?: string[];
  isVerified?: boolean;
  subscription?: SubscriptionInfo;
  subscriptionRequest?: {
    packageId: string;
    receiptBase64: string;
    submittedAt: number;
  };
  isBanned?: boolean;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isLoading: false 
  }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
