import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { heartbeat } from '../services/auth-api';
import {
  AUTH_LOGOUT_EVENT,
  setAuthMessage,
} from '../services/auth-session';
import './ActivityContext.css';

const MINUTE = 60_000;
const PRESENCE_INTERVAL_MS = MINUTE;
const ACTIVE_INTERVAL_MS = MINUTE;
const BROADCAST_INTERVAL_MS = 5_000;
const IDLE_TICK_MS = 1_000;
const CHANNEL_NAME = 'auth-activity';

interface ActivityContextType {
  markActive: () => void;
  setVideoPlaying: (playing: boolean) => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

function readMs(key: string, envValue: string | undefined, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 1_000) return parsed;
  } catch {
    // Fall through to the env/default value.
  }
  const parsedEnv = Number(envValue);
  if (Number.isFinite(parsedEnv) && parsedEnv >= 1_000) return parsedEnv;
  return fallback;
}

function tokenSuffix(token: string) {
  return token.slice(-16);
}

function activityKey(token: string) {
  return `auth:last-activity:${tokenSuffix(token)}`;
}

function logoutKey(token: string) {
  return `auth:last-logout:${tokenSuffix(token)}`;
}

interface BroadcastMessage {
  type: 'activity' | 'logout';
  at?: number;
}

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const config = useMemo(() => {
    const warnMs = readMs(
      'usageIdleWarnMs',
      import.meta.env.VITE_IDLE_WARN_MS as string | undefined,
      29 * MINUTE
    );
    const logoutMs = Math.max(
      warnMs + 1_000,
      readMs(
        'usageIdleLogoutMs',
        import.meta.env.VITE_IDLE_LOGOUT_MS as string | undefined,
        30 * MINUTE
      )
    );
    return { warnMs, logoutMs };
  }, []);

  const [warnVisible, setWarnVisible] = useState(false);
  const tokenRef = useRef(token);
  const lastActiveRef = useRef(0);
  const lastActivitySentRef = useRef(0);
  const lastBroadcastRef = useRef(0);
  const videoPlayingRef = useRef(false);
  const warnedRef = useRef(false);
  const loggingOutRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const sendHeartbeat = useCallback(
    async (active: boolean, keepalive = false) => {
      const currentToken = tokenRef.current;
      if (!currentToken) return;
      try {
        await heartbeat(currentToken, active, keepalive);
      } catch {
        // Network failures are retried by the next heartbeat.
      }
    },
    []
  );

  const sendActive = useCallback(
    (force = false) => {
      const now = Date.now();
      if (!force && now - lastActivitySentRef.current < ACTIVE_INTERVAL_MS) return;
      lastActivitySentRef.current = now;
      void sendHeartbeat(true);
    },
    [sendHeartbeat]
  );

  const markActive = useCallback(() => {
    const now = Date.now();
    lastActiveRef.current = now;

    if (now - lastBroadcastRef.current >= BROADCAST_INTERVAL_MS) {
      lastBroadcastRef.current = now;
      const currentToken = tokenRef.current;
      if (currentToken) {
        try {
          localStorage.setItem(activityKey(currentToken), String(now));
        } catch {
          // Storage may be unavailable; BroadcastChannel still works.
        }
        channelRef.current?.postMessage({ type: 'activity', at: now } satisfies BroadcastMessage);
      }
    }

    sendActive();
  }, [sendActive]);

  const setVideoPlaying = useCallback(
    (playing: boolean) => {
      videoPlayingRef.current = playing;
      lastActiveRef.current = Date.now();
      if (playing) {
        setWarnVisible(false);
        warnedRef.current = false;
      }
      // Pause/end restarts the normal idle countdown from now.
      sendActive(true);
    },
    [sendActive]
  );

  // Reload the local activity clock whenever the authenticated token changes.
  useEffect(() => {
    if (!token) return;
    let saved = 0;
    try {
      saved = Number(localStorage.getItem(activityKey(token))) || 0;
    } catch {
      saved = 0;
    }
    const now = Date.now();
    lastActiveRef.current =
      saved > 0 && now - saved < config.logoutMs ? saved : now;
    lastActivitySentRef.current = 0;
    lastBroadcastRef.current = 0;
    videoPlayingRef.current = false;
    warnedRef.current = false;
    loggingOutRef.current = false;
    setWarnVisible(false);
  }, [token, config.logoutMs]);

  // Presence heartbeat keeps the session known-online while the page is open.
  useEffect(() => {
    if (!token) return;
    void sendHeartbeat(false);
    const timer = window.setInterval(() => {
      void sendHeartbeat(false);
    }, PRESENCE_INTERVAL_MS);

    const handlePageHide = () => {
      void sendHeartbeat(false, true);
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [token, sendHeartbeat]);

  // Any real interaction refreshes activity; visible page also refreshes presence.
  useEffect(() => {
    if (!token) return;

    const onInteraction = () => markActive();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        markActive();
        void sendHeartbeat(false);
      } else {
        void sendHeartbeat(false, true);
      }
    };

    const options: AddEventListenerOptions = { passive: true, capture: true };
    document.addEventListener('pointerdown', onInteraction, options);
    document.addEventListener('keydown', onInteraction, options);
    document.addEventListener('wheel', onInteraction, options);
    document.addEventListener('touchstart', onInteraction, options);
    document.addEventListener('scroll', onInteraction, options);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('pointerdown', onInteraction, options);
      document.removeEventListener('keydown', onInteraction, options);
      document.removeEventListener('wheel', onInteraction, options);
      document.removeEventListener('touchstart', onInteraction, options);
      document.removeEventListener('scroll', onInteraction, options);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, markActive, sendHeartbeat]);

  // Route changes count as activity (the student navigated somewhere).
  useEffect(() => {
    if (token) markActive();
  }, [location.pathname, token, markActive]);

  // Cross-tab activity and logout coordination.
  useEffect(() => {
    if (!token) return;
    const activityStorageKey = activityKey(token);
    const logoutStorageKey = logoutKey(token);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channelRef.current = channel;
      channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        const message = event.data;
        if (!message) return;
        if (message.type === 'activity' && Number.isFinite(message.at)) {
          lastActiveRef.current = Math.max(lastActiveRef.current, message.at as number);
        } else if (message.type === 'logout' && !loggingOutRef.current) {
          loggingOutRef.current = true;
          setAuthMessage('您已在其他标签页退出登录');
          void logout('remote').finally(() => {
            if (window.location.pathname !== '/login') {
              navigate('/login', { replace: true });
            }
          });
        }
      };
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key === activityStorageKey && event.newValue) {
        const at = Number(event.newValue);
        if (Number.isFinite(at)) {
          lastActiveRef.current = Math.max(lastActiveRef.current, at);
        }
      }
      if (event.key === logoutStorageKey && !loggingOutRef.current) {
        loggingOutRef.current = true;
        setAuthMessage('您已在其他标签页退出登录');
        void logout('remote').finally(() => {
          if (window.location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
        });
      }
    };

    const onLocalLogout = () => {
      channel?.postMessage({ type: 'logout' } satisfies BroadcastMessage);
      try {
        localStorage.setItem(logoutStorageKey, String(Date.now()));
        localStorage.removeItem(activityStorageKey);
      } catch {
        // Ignore storage failures.
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(AUTH_LOGOUT_EVENT, onLocalLogout);

    return () => {
      channel?.close();
      if (channelRef.current === channel) channelRef.current = null;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(AUTH_LOGOUT_EVENT, onLocalLogout);
    };
  }, [token, logout, navigate]);

  // Idle countdown, warning and automatic logout for students only.
  useEffect(() => {
    if (!token || user?.role !== 'student') return;

    const timer = window.setInterval(() => {
      if (loggingOutRef.current) return;
      const now = Date.now();

      if (videoPlayingRef.current) {
        lastActiveRef.current = now;
        if (warnedRef.current) {
          warnedRef.current = false;
          setWarnVisible(false);
        }
        sendActive();
        return;
      }

      const idleMs = now - lastActiveRef.current;
      if (idleMs >= config.logoutMs) {
        loggingOutRef.current = true;
        setWarnVisible(false);
        warnedRef.current = false;
        setAuthMessage('长时间未操作，已自动退出登录');
        void logout('idle').finally(() => {
          if (window.location.pathname !== '/login') {
            navigate('/login', { replace: true });
          }
        });
        return;
      }

      if (idleMs >= config.warnMs) {
        if (!warnedRef.current) {
          warnedRef.current = true;
          setWarnVisible(true);
        }
      } else if (warnedRef.current) {
        warnedRef.current = false;
        setWarnVisible(false);
      }
    }, IDLE_TICK_MS);

    return () => window.clearInterval(timer);
  }, [token, user?.role, config.warnMs, config.logoutMs, logout, navigate, sendActive]);

  const continueUsing = () => {
    warnedRef.current = false;
    setWarnVisible(false);
    lastActiveRef.current = Date.now();
    lastActivitySentRef.current = 0;
    markActive();
  };

  const logoutNow = () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setWarnVisible(false);
    warnedRef.current = false;
    setAuthMessage('已退出登录');
    void logout('manual').finally(() => {
      if (window.location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    });
  };

  return (
    <ActivityContext.Provider value={{ markActive, setVideoPlaying }}>
      {children}
      {warnVisible && user?.role === 'student' && (
        <div className="usage-idle-overlay" role="dialog" aria-modal="true" aria-labelledby="usage-idle-title">
          <div className="usage-idle-card">
            <h2 id="usage-idle-title">还在学习吗？</h2>
            <p>再过 1 分钟没有操作，系统将自动退出登录。</p>
            <div className="usage-idle-actions">
              <button type="button" className="usage-idle-primary" onClick={continueUsing}>
                继续使用
              </button>
              <button type="button" className="usage-idle-secondary" onClick={logoutNow}>
                立即退出
              </button>
            </div>
          </div>
        </div>
      )}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (context === undefined) {
    throw new Error('useActivity must be used within an ActivityProvider');
  }
  return context;
}
