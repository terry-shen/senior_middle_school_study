/**
 * Browser-side session helpers.
 *
 * Every API response is checked for 401 so an expired/idle session is cleared
 * globally instead of leaving pages in a half-logged-in state.
 */

export const AUTH_EXPIRED_EVENT = 'auth:expired';
export const AUTH_LOGOUT_EVENT = 'auth:logged-out';
export const AUTH_MESSAGE_KEY = 'auth:message';

let installed = false;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

export function installAuthFetchGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await originalFetch(input, init);
    if (response.status === 401) {
      const url = requestUrl(input);
      const isAuthEntry =
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/register') ||
        url.includes('/api/auth/logout');
      if (url.includes('/api/') && !isAuthEntry) {
        window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
      }
    }
    return response;
  };
}

export function setAuthMessage(message: string) {
  try {
    sessionStorage.setItem(AUTH_MESSAGE_KEY, message);
  } catch {
    // Ignore storage failures; the redirect still works.
  }
}

export function consumeAuthMessage(): string {
  try {
    const message = sessionStorage.getItem(AUTH_MESSAGE_KEY) ?? '';
    sessionStorage.removeItem(AUTH_MESSAGE_KEY);
    return message;
  } catch {
    return '';
  }
}
