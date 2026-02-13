import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { authApi, mapBackendUserToAuthUser } from "../utils/authApi";
import { AuthUser, AuthContextType, RegisterData } from "../types/auth";
import { ApiError } from "../utils/api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // For form loading states
  const navigate = useNavigate();

  // Check for existing token on mount and validate it
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (authApi.isAuthenticated()) {
          // Validate token by fetching current user
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        // Token is invalid, remove it
        authApi.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authApi.login({ email, password });
      const authUser = mapBackendUserToAuthUser(response.user);
      setUser(authUser);
    } catch (error) {
      let errorMessage = "Login failed";

      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterData): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await authApi.register(userData);
      const authUser = mapBackendUserToAuthUser(response.user);
      setUser(authUser);
    } catch (error) {
      let errorMessage = "Registration failed";

      if (error instanceof ApiError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    authApi.logout();
    setUser(null);
    navigate("/login");
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    loading,
    isLoading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
