import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { LogoutReason, User } from '../services/auth-api';
import { login as loginApi, logout as logoutApi, getCurrentUser } from '../services/auth-api';
import {
  AUTH_EXPIRED_EVENT,
  AUTH_LOGOUT_EVENT,
  AUTH_MESSAGE_KEY,
  setAuthMessage,
} from '../services/auth-session';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (studentId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: (reason?: LogoutReason) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const clearingRef = useRef(false);

  const clearAuth = useCallback((reason: LogoutReason) => {
    if (clearingRef.current) return;
    clearingRef.current = true;
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    // ActivityProvider broadcasts this so other tabs clear immediately.
    // A remote tab has already been instructed by the broadcaster.
    if (reason !== 'remote') {
      window.dispatchEvent(
        new CustomEvent(AUTH_LOGOUT_EVENT, { detail: { reason } })
      );
    }
  }, []);

  const logout = useCallback(
    async (reason: LogoutReason = 'manual') => {
      if (token && (reason === 'manual' || reason === 'idle')) {
        try {
          await logoutApi(token, reason);
        } catch {
          // Local logout still proceeds when the network is unavailable.
        }
      }
      clearAuth(reason);
    },
    [token, clearAuth]
  );

  useEffect(() => {
    const handleExpired = () => {
      setAuthMessage('登录状态已失效，请重新登录');
      void logout('expired');
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [logout, navigate]);

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
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
          }
        })
        .catch(() => {
          window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (studentId: string, password: string) => {
    const result = await loginApi(studentId, password);
    if (result.success && result.token && result.user) {
      clearingRef.current = false;
      try {
        sessionStorage.removeItem(AUTH_MESSAGE_KEY);
      } catch {
        // Ignore storage failures.
      }
      localStorage.setItem('token', result.token);
      setToken(result.token);
      setUser(result.user);
      return { success: true };
    }
    return { success: false, error: result.error };
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
