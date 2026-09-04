import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../services/auth-api';
import { login as loginApi, logout as logoutApi, getCurrentUser } from '../services/auth-api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (studentId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      getCurrentUser(savedToken)
        .then((data) => {
          if (data.user) {
            setUser(data.user);
            setToken(savedToken);
          } else {
            localStorage.removeItem('token');
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (studentId: string, password: string) => {
    const result = await loginApi(studentId, password);
    if (result.success && result.token && result.user) {
      localStorage.setItem('token', result.token);
      setToken(result.token);
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
  };

  const logout = async () => {
    if (token) {
      await logoutApi(token);
    }
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}