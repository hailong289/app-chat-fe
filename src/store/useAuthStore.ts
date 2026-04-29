import { create } from "zustand";
import { AuthState } from "./types/auth.state";
import AuthService from "@/service/auth.service";
import * as LocalStorageUtils from "@/utils/localStorage";
import { tokenStorage } from "@/utils/tokenStorage";
import { AuthResponse } from "@/types/auth.type";
import { cleanupFirebaseMessaging, messaging } from "@/libs/firebase";
import { openDbForUser, closeUserDb } from "@/libs/db";
import { trackAuthInFlight } from "@/libs/tokenRefresh";
import useMessageStore from "./useMessageStore";
import useRoomStore from "./useRoomStore";

/**
 * Zustand auth store. Intentionally NOT wrapped in `persist` — the
 * whole-state serialisation pulls in `user`, transient flags, and (in
 * past iterations) refreshToken. Instead:
 *   - accessToken is mirrored into `localStorage["accessToken"]` via
 *     `tokenStorage` so other modules (socket handshake, axios Bearer
 *     header) can read it without going through Zustand.
 *   - refreshToken stays in the HttpOnly cookie (path: /auth).
 *   - user is fetched fresh on boot via fetchMe().
 *
 * On boot we synchronously seed `accessToken` from localStorage so the
 * store starts in the "authenticated" state even before fetchMe() runs.
 * The lingering `auth-storage` key from earlier persist-based versions
 * is removed on first import to clear out stale snapshots.
 */
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("auth-storage");
  } catch {
    /* private mode / quota — ignore */
  }
}

const useAuthStore = create<AuthState>()(
    (set, get) => ({
      isAuthenticated: !!tokenStorage.get(),
      isLoading: false,
      // user stays null until fetchMe() resolves. The JWT payload has
      // enough to scope IndexedDB (usr_id) — see getCachedUserIdFromToken
      // in @/libs/db — but the rest (avatar, role, etc.) must come from
      // the BE so we always show fresh data.
      user: null,
      tokens: {
        accessToken: tokenStorage.get(),
        refreshToken: null,
        expiresIn: 0,
        expiredAt: 0,
      },
      login: async (payload) => {
        set({ isLoading: true });
        const { username, password, fcmToken } = payload;
        // Hold the auth-lock until we've persisted the new accessToken
        // into BOTH localStorage and the Zustand store. If we only locked
        // around AuthService.login (the network call) the .finally would
        // release the lock before tokenStorage.set / set({tokens}) ran,
        // and queued requests could resume reading the OLD null token.
        let release!: () => void;
        trackAuthInFlight(new Promise<void>((r) => { release = r; }));
        try {
          const dateNow = Math.floor(Date.now() / 1000);
          const response = await AuthService.login({
            username,
            password,
            fcmToken,
          });

          const accessToken = response.data.metadata?.accessToken || null;
          // Mirror to localStorage["accessToken"] so non-React modules
          // (axios interceptor, socket handshake) can read it without
          // touching the Zustand store.
          tokenStorage.set(accessToken);

          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.data.metadata?.user,
            tokens: {
              accessToken,
              // refreshToken stays in the HttpOnly cookie (path: /auth).
              refreshToken: null,
              expiresIn: response.data.metadata?.expiresIn || 0,
              expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
            },
          });

          // Open the per-user IndexedDB. If this user has logged in
          // before on this device, their cached data (rooms, messages,
          // contacts) is restored instantly. Otherwise a fresh DB is
          // created with the user-scoped name `app-chat-db-{userId}`.
          const userIdForDb = response.data.metadata?.user?.id;
          if (userIdForDb) {
            try {
              openDbForUser(userIdForDb);
            } catch (err) {
              console.warn("[login] openDbForUser failed", err);
            }
          }

          // The HttpOnly `tokens` cookie (refreshToken-only, scoped to
          // /auth) is set by the BE (libs/helpers/src/auth-cookie.helper).
          // FE no longer touches document.cookie for auth — this avoids
          // duplicate cookies + keeps the refresh token JS-unreachable.
          payload.callback?.();
        } catch (error) {
          set({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: {
              accessToken: null,
              refreshToken: null,
              expiresIn: 0,
              expiredAt: 0,
            },
          });
          payload.callback?.(error);
        } finally {
          release();
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        // Same auth-lock pattern as login — held until token is persisted.
        let release!: () => void;
        trackAuthInFlight(new Promise<void>((r) => { release = r; }));
        try {
          const response = await AuthService.register(payload);
          const dateNow = Math.floor(Date.now() / 1000);
          const accessToken = response.data.metadata?.accessToken || null;
          // Same accessToken-in-localStorage pattern as login. Without
          // this, register would leave the store authenticated but
          // axios + sockets unable to find the token.
          tokenStorage.set(accessToken);
          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.data.metadata?.user,
            tokens: {
              accessToken,
              refreshToken: null,
              expiresIn: response.data.metadata?.expiresIn || 0,
              expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
            },
          });
          // Same per-user DB open as login — fresh user gets a fresh DB.
          const userIdForDb = response.data.metadata?.user?.id;
          if (userIdForDb) {
            try {
              openDbForUser(userIdForDb);
            } catch (err) {
              console.warn("[register] openDbForUser failed", err);
            }
          }
          payload.callback?.();
        } catch (error) {
          set({ isAuthenticated: false, isLoading: false, user: null });
          payload.callback?.(error);
        } finally {
          release();
        }
      },
      logout: async (callback) => {
        set({ isLoading: true });
        let fcmToken: string | undefined;
        try {
          if (messaging) {
            try {
              const { getToken } = await import("firebase/messaging");
              fcmToken = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              });
            } catch (err) {
              console.warn(
                "Could not retrieve FCM token for logout cleanup",
                err,
              );
            }
          }

          // BE call may fail (network down, token already invalid, etc.)
          // — we still want the FE to log out cleanly. swallow + log.
          try {
            await AuthService.logout({ fcmToken });
          } catch (apiErr) {
            console.warn("[logout] BE call failed, clearing FE anyway", apiErr);
          }

          // Cleanup Firebase / local storage / sibling stores. Each
          // wrapped in try-catch so a single failure doesn't block the
          // rest of the cleanup.
          try {
            await cleanupFirebaseMessaging();
          } catch (err) {
            console.warn("[logout] firebase cleanup failed", err);
          }
          // Close — don't delete — the per-user IndexedDB. Data stays
          // on disk so re-login by the same user reopens cached
          // rooms/messages instantly. For "delete my data" flows use
          // `clearIndexedDB()` from @/libs/db.
          try {
            closeUserDb();
          } catch (err) {
            console.warn("[logout] dexie close failed", err);
          }
          try {
            LocalStorageUtils.clearAllLocalStorage();
          } catch (err) {
            console.warn("[logout] localStorage cleanup failed", err);
          }
          useMessageStore.setState({ messagesRoom: {}, isLoading: false });
          useRoomStore.setState({ rooms: [], room: null, isLoading: false });

          callback?.();
        } catch (error) {
          // Outer catch — should rarely fire because inner blocks all
          // catch their own. Still log + run callback.
          console.error("[logout] unexpected error", error);
          callback?.(error);
        } finally {
          // ALWAYS reset auth state regardless of which step failed.
          // Without this `finally`, a failure mid-cleanup left
          // isLoading=true forever and the FE thought it was still
          // logging out (UI stuck on spinner / "đang xử lý").
          set({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: {
              accessToken: null,
              refreshToken: null,
              expiresIn: 0,
              expiredAt: 0,
            },
          });
          // Drop accessToken from localStorage so any module reading
          // tokenStorage.get() after logout sees null. Cookie is cleared
          // BE-side via clearAuthCookie() in /auth/logout — no JS-side
          // delete needed (HttpOnly anyway).
          tokenStorage.clear();
        }
      },
      fetchMe: async () => {
        // Pulled apart from refreshToken: this is for the "I have an
        // accessToken in localStorage but no user info" boot path. Hits
        // /auth/me which (server-side) reads JWT → returns the latest
        // user record. If the token is stale, the refresh interceptor
        // kicks in transparently; if refresh fails → full logout.
        try {
          const response = await AuthService.getMe();
          // Two response shapes accepted: the canonical Response.success
          // wrapper (`{ metadata: { user } }`) and the legacy raw shape
          // (`{ user }`) — protects against rolling deploys where the
          // BE hasn't been rebuilt yet.
          const data = response.data as
            | { metadata?: { user?: any }; user?: any }
            | undefined;
          const user = data?.metadata?.user ?? data?.user;
          if (user) {
            set({ user, isAuthenticated: true });
          } else {
            console.warn("[fetchMe] no user in response", data);
          }
        } catch (err: any) {
          // Surface the real failure so we can diagnose 401 vs 5xx vs
          // network. Previously this just printed `failed` with no body.
          const status = err?.statusCode ?? err?.response?.status;
          const message = err?.message || err?.response?.data?.message;
          console.warn(
            `[fetchMe] failed${status ? ` (${status})` : ""}: ${message}`,
            err,
          );
        }
      },
      refreshToken: async () => {
        // refreshToken lives in the HttpOnly cookie now — FE doesn't
        // see it. We just call the endpoint; BE reads the cookie and
        // returns a fresh accessToken in the body. No header / no body
        // needed (AuthService.refreshToken already strips Authorization
        // so middleware enters its refresh-token branch).
        try {
          const response = await AuthService.refreshToken();
          const dateNow = Math.floor(Date.now() / 1000);
          const metadata = response.data?.metadata as AuthResponse["metadata"];

          if (
            !metadata ||
            typeof metadata.accessToken !== "string" ||
            typeof metadata.expiresIn !== "number"
          ) {
            throw new Error("No valid metadata returned");
          }

          // Mirror new accessToken into localStorage so axios + sockets
          // pick it up immediately. Order matters: localStorage first,
          // then Zustand state — ensures listeners reading either source
          // see the new token.
          tokenStorage.set(metadata.accessToken);
          set({
            isAuthenticated: true,
            user: (metadata as any).user || get().user,
            tokens: {
              accessToken: metadata.accessToken,
              refreshToken: null,
              expiresIn: metadata.expiresIn,
              expiredAt: dateNow + metadata.expiresIn,
            },
          });
        } catch (error: any) {
          console.error("Manual refresh failed:", error?.message || error);
          // Refresh failed (cookie expired / revoked / never set) →
          // full logout flow.
          get().logout();
        }
      },
      forgotPassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.forgotPassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          payload.callback?.(error);
          set({ isLoading: false });
        }
      },
      resetPassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.resetPassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          payload.callback?.(error);
          set({ isLoading: false });
        }
      },
      updateProfile: async (payload) => {
        set({ isLoading: true });
        try {
          const response = await AuthService.updateProfile(payload);
          const metadata = response.data.metadata as any;

          if (metadata?.user) {
            set({ user: metadata.user, isLoading: false });
          } else {
            // Nếu backend không trả về user mới, tự update local state
            const currentUser = get().user;
            if (currentUser) {
              set({
                user: {
                  ...currentUser,
                  fullname: payload.fullname ?? currentUser.fullname,
                  gender: payload.gender ?? currentUser.gender,
                  dateOfBirth: payload.dateOfBirth ?? currentUser.dateOfBirth,
                  address: payload.address ?? currentUser.address,
                  email: payload.email ?? currentUser.email,
                  phone: payload.phone ?? currentUser.phone,
                },
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          }
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      updateAvatar: async (payload) => {
        set({ isLoading: true });
        try {
          const response = await AuthService.updateAvatar(payload);
          const metadata = response.data.metadata as any;

          if (metadata?.user) {
            set({ user: metadata.user, isLoading: false });
          } else if (metadata?.url) {
            const currentUser = get().user;
            if (currentUser) {
              set({
                user: { ...currentUser, avatar: metadata.url },
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          } else {
            set({ isLoading: false });
          }
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      updatePassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.updatePassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      setAuth: (isAuthenticated) => set({ isAuthenticated }),
    })
);

// Boot bootstrap moved into a React effect (see ClientLayout) so the
// retry logic + auth-guard navigation are coordinated in one place.
// Module-level side effects didn't always re-run on full page reloads
// in Next.js dev (HMR caches the module), and user state could end up
// null without a fetchMe attempt. The effect-driven version always
// fires on mount and re-tries when the token is present but user
// hasn't resolved yet.

export default useAuthStore;
