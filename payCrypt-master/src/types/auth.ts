export interface AuthUser {
  id: string;
  tag: string;
  email: string;
  address: string;
  photo: string;
  is_verified: boolean;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  created_at: string;
  updated_at: string;
  last_login: string;
  role: "user" | "admin";
}

export interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isLoading: boolean; // For form loading states
  isAuthenticated: boolean;
}

export interface RegisterData {
  email: string;
  tag: string;
  address: string; // This will be auto-generated
  password: string;
}
