import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { clearStoredToken, getStoredToken, setStoredToken } from "../services/api";
import { fetchCurrentUser, loginRequest, type LoginRequest } from "../services/auth.service";
import type { UserProfile } from "../types/auth";

type AuthContextValue = {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (input: LoginRequest) => Promise<UserProfile>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const storedToken = getStoredToken();

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetchCurrentUser();
      setUser(response.user);
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  const login = useCallback(async (input: LoginRequest) => {
    const response = await loginRequest(input);
    setStoredToken(response.token);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
      refreshUser
    }),
    [isLoading, login, logout, refreshUser, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
