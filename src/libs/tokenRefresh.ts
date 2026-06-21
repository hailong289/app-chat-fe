import useAuthStore from "@/store/useAuthStore";

/**
 * Singleton refresh-token manager.
 *
 * Problems this solves:
 *  1. **Concurrent 401s**: Without coordination, every parallel API call
 *     that gets a 401 would trigger its own /auth/refresh, racing each
 *     other and potentially invalidating each other's tokens. We collapse
 *     all callers onto ONE in-flight promise.
 *  2. **APIs called mid-refresh**: A request issued while we're refreshing
 *     should NOT use the old (about-to-be-invalidated) token. Callers
 *     await `getValidToken()` which waits for the in-flight refresh.
 *  3. **Sockets stale auth**: When the access token rotates, sockets need
 *     to re-handshake with the new token. Subscribers (SocketProvider)
 *     get notified via `subscribeTokenRefresh`.
 */

let refreshPromise: Promise<string | null> | null = null;
type Subscriber = (token: string | null) => void;
const subscribers: Set<Subscriber> = new Set();

// Login/register in-flight tracker. While the user is authenticating,
// any other API call (notifications fetched on layout mount, fetchMe
// kicked off elsewhere, etc.) should QUEUE behind the login — otherwise
// they fire with no token, hit 401, and trigger a useless refresh
// attempt that fails noisily because there's no refresh cookie yet.
let authPromise: Promise<unknown> | null = null;

/**
 * Trigger or join the in-flight refresh. Returns the new access token
 * (or null on failure — caller should treat null as "log the user out").
 *
 * If a refresh is already running, the second call awaits the SAME
 * promise — no double network request.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      await useAuthStore.getState().refreshToken();
      const newToken =
        useAuthStore.getState().tokens?.accessToken ?? null;
      // Notify subscribers (sockets, query clients, etc.) of the new
      // token AFTER state + cookie are updated.
      subscribers.forEach((cb) => {
        try {
          cb(newToken);
        } catch (err) {
          console.warn("[tokenRefresh] subscriber threw:", err);
        }
      });
      return newToken;
    } catch (err) {
      console.error("[tokenRefresh] refresh failed:", err);
      // Notify subscribers with null so they can disconnect/cleanup.
      subscribers.forEach((cb) => {
        try {
          cb(null);
        } catch {}
      });
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Returns true while a refresh is in flight. Used by axios interceptor
 * to queue NEW requests until the refresh resolves (avoid racing with
 * an about-to-rotate token).
 */
export function isRefreshing(): boolean {
  return refreshPromise !== null;
}

/**
 * Wait for the in-flight refresh to finish (resolves with the new token
 * or null). Returns immediately if no refresh is happening.
 */
export function awaitRefreshIfAny(): Promise<string | null> {
  return refreshPromise ?? Promise.resolve(null);
}

/**
 * Subscribe to token refresh events. Subscribers are called AFTER the
 * new token is persisted to Zustand + cookie. Returns an unsubscribe
 * function.
 */
export function subscribeTokenRefresh(cb: Subscriber): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

/**
 * Mark login/register as in-flight. Any non-auth API request issued
 * during this window will await the promise before sending — so they
 * pick up the freshly-set Bearer token instead of firing tokenless
 * and bouncing through a doomed /auth/refresh.
 *
 * The store's login() wraps its own AuthService.login call in this so
 * components that mount mid-login (NotificationDropdown, fetchMe, etc.)
 * naturally queue.
 */
export function trackAuthInFlight<T>(promise: Promise<T>): Promise<T> {
  authPromise = promise.finally(() => {
    if (authPromise === promise) authPromise = null;
  });
  return promise;
}

export function isAuthInFlight(): boolean {
  return authPromise !== null;
}

export function awaitAuthInFlight(): Promise<unknown> {
  return authPromise ?? Promise.resolve(null);
}
