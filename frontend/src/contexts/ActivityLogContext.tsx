import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import {
  reportActivityEvents,
  type ActivityEventInput,
  type ActivityEventType,
} from '../services/activity-log-api';

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_AT = 20;
const MAX_BATCH = 50;
const MAX_QUEUE = 500;
const MAX_TARGET = 120;
const MAX_LABEL = 80;

const EVENT_TYPES = new Set<ActivityEventType>([
  'page_view',
  'nav_click',
  'subject_open',
  'chapter_open',
  'asset_open',
  'video_play',
  'video_pause',
  'video_ended',
  'video_seek',
  'search',
  'filter',
  'download',
  'ui_click',
]);

export type ActivityDraft = Omit<ActivityEventInput, 'pagePath'> & { pagePath?: string };

interface ActivityLogContextType {
  logActivity: (event: ActivityDraft) => void;
  flushActivity: (keepalive?: boolean) => void;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

function trim(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function toId(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function describeTarget(el: Element): string {
  if (el.id) return el.id;
  const tag = el.tagName.toLowerCase();
  const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
  return cls ? `${tag}.${cls}` : tag;
}

function labelOf(el: Element): string | null {
  const aria = el.getAttribute('aria-label');
  if (aria) return trim(aria, MAX_LABEL);
  const title = el.getAttribute('title');
  if (title) return trim(title, MAX_LABEL);
  return trim(el.textContent, MAX_LABEL);
}

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const location = useLocation();
  const tokenRef = useRef<string | null>(token);
  const lastTokenRef = useRef<string | null>(token);
  const queueRef = useRef<ActivityEventInput[]>([]);
  const timerRef = useRef<number | null>(null);
  const flushRef = useRef<(keepalive?: boolean) => void>(() => {});
  const sendingRef = useRef(false);
  const retriedRef = useRef(false);

  useEffect(() => {
    // Never carry queued events from one account/session token into another.
    if (lastTokenRef.current !== token) {
      lastTokenRef.current = token;
      queueRef.current = [];
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
    tokenRef.current = token;
    if (!token) {
      queueRef.current = [];
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [token]);

  const flush = useCallback((keepalive = false) => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const currentToken = tokenRef.current;
    if (!currentToken || queueRef.current.length === 0) return;

    // Unloading the page: one best-effort batch without retries.
    if (keepalive) {
      const batch = queueRef.current.splice(0, MAX_BATCH);
      reportActivityEvents(currentToken, batch, true).catch(() => {
        // Activity logging is best-effort and must never disturb learning.
      });
      return;
    }

    if (sendingRef.current) return;
    sendingRef.current = true;

    const drain = async () => {
      while (queueRef.current.length > 0 && tokenRef.current === currentToken) {
        const batch = queueRef.current.splice(0, MAX_BATCH);
        try {
          await reportActivityEvents(currentToken, batch);
          retriedRef.current = false;
        } catch {
          // Retry the failed batch once; after that drop it and continue.
          if (!retriedRef.current) {
            retriedRef.current = true;
            queueRef.current.unshift(...batch);
            timerRef.current = window.setTimeout(() => {
              timerRef.current = null;
              flushRef.current(false);
            }, FLUSH_INTERVAL_MS);
          }
          break;
        }
      }
      sendingRef.current = false;
      if (queueRef.current.length > 0 && timerRef.current == null) {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          flushRef.current(false);
        }, FLUSH_INTERVAL_MS);
      }
    };

    void drain();
  }, []);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const logActivity = useCallback(
    (event: ActivityDraft) => {
      if (!tokenRef.current || user?.role !== 'student') return;
      const rawPath = event.pagePath || location.pathname;
      const pagePath = rawPath.split(/[?#]/, 1)[0] || location.pathname;
      const item: ActivityEventInput = {
        type: event.type,
        pagePath,
        target: trim(event.target, MAX_TARGET),
        label: trim(event.label, MAX_LABEL),
        subjectId: event.subjectId ?? null,
        sectionId: event.sectionId ?? null,
        assetId: event.assetId ?? null,
        meta: event.meta ?? null,
      };
      if (queueRef.current.length >= MAX_QUEUE) {
        queueRef.current.splice(0, queueRef.current.length - MAX_QUEUE + 1);
      }
      queueRef.current.push(item);
      if (queueRef.current.length >= FLUSH_AT) {
        flushRef.current(false);
      } else if (timerRef.current == null) {
        timerRef.current = window.setTimeout(() => flushRef.current(false), FLUSH_INTERVAL_MS);
      }
    },
    [location.pathname, user?.role]
  );

  // Page views: one per route change for students only.
  useEffect(() => {
    if (!token || user?.role !== 'student') return;
    logActivity({
      type: 'page_view',
      target: location.pathname,
      label: document.title || location.pathname,
    });
  }, [token, user?.role, location.pathname, logActivity]);

  // Global capture: semantic data-track wins; every other actionable click is ui_click.
  useEffect(() => {
    if (!token || user?.role !== 'student') return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('[data-track-skip]')) return;
      // Never describe or capture text entry, passwords or textareas.
      if (target.closest('input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]')) return;

      const tracked = target.closest<HTMLElement>('[data-track]');
      const actionable = tracked || target.closest('a,button,[role="button"],select,input[type="checkbox"],input[type="radio"]');
      if (!actionable) return;
      if (actionable.matches(':disabled')) return;

      const rawType = tracked?.dataset.track;
      const type: ActivityEventType =
        rawType && EVENT_TYPES.has(rawType as ActivityEventType) ? (rawType as ActivityEventType) : 'ui_click';

      logActivity({
        type,
        target: tracked?.dataset.trackTarget || describeTarget(actionable),
        label: tracked?.dataset.trackLabel || labelOf(actionable),
        subjectId: toId(tracked?.dataset.trackSubjectId),
        sectionId: toId(tracked?.dataset.trackSectionId),
        assetId: toId(tracked?.dataset.trackAssetId),
      });
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [token, user?.role, logActivity]);

  useEffect(() => {
    if (!token || user?.role !== 'student') return;

    const flushNow = () => flushRef.current(true);
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onHidden);
      flushRef.current(true);
    };
  }, [token, user?.role]);

  return (
    <ActivityLogContext.Provider value={{ logActivity, flushActivity: flush }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog() {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider');
  }
  return context;
}
