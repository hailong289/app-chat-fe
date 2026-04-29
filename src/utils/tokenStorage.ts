/**
 * accessToken storage helper.
 *
 * Why a separate key (not Zustand persist):
 *   - Zustand's `persist` middleware serialises the WHOLE state object
 *     under one key (`auth-storage`) which inevitably picks up
 *     `user`, ephemeral flags, and (historically) refreshToken — all of
 *     which we explicitly do NOT want in localStorage. Splitting just
 *     the accessToken into its own key keeps the surface minimal:
 *     other features (sockets, axios interceptors, lazy refreshes) can
 *     read JUST the token without round-tripping through Zustand.
 *   - refreshToken stays in the HttpOnly cookie; user data is fetched
 *     fresh from /auth/me on boot.
 *
 * SSR-safe: every method early-returns when `window` is undefined so
 * Next.js server-side renders don't crash.
 */
const ACCESS_TOKEN_KEY = "accessToken";

export const tokenStorage = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null): void {
    if (typeof window === "undefined") return;
    try {
      if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
      else localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Quota or private-mode block — caller can detect via a follow-up
      // get() returning null. Don't crash the auth flow.
    }
  },
  clear(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // ignore
    }
  },
};

/**
 * JWT payload shape signed by auth.service. Mirrors `Utils.omit(user, ...)`
 * + `{ jti, clientId }`. We read just enough to bootstrap per-user
 * client state synchronously before /auth/me resolves.
 */
interface DecodedAccessTokenPayload {
  _id?: string; // MongoDB ObjectId
  usr_id?: string; // ULID — FE-facing user id (canonical)
  usr_fullname?: string;
  usr_email?: string;
  usr_phone?: string;
  usr_avatar?: string;
  usr_status?: string;
  jti?: string;
  clientId?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Decode the JWT payload SYNCHRONOUSLY without verification. The full
 * user object is right there in the payload (BE signs the entire user
 * record minus `usr_salt`), so we don't need /auth/me to bootstrap
 * per-user state like IndexedDB or call clientId.
 *
 * No signature verification — the BE re-validates on every API call
 * anyway, so a forged token only buys an attacker the wrong local
 * IndexedDB on their own machine. Not exploitable cross-user.
 *
 * Returns null on any decoding failure (missing token, malformed JWT,
 * non-JSON payload) so callers can safely fall back to "wait for
 * fetchMe".
 */
export function decodeAccessToken(): DecodedAccessTokenPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // base64url → base64 then atob, then UTF-8 decode for non-ASCII
    // (e.g. usr_fullname containing Vietnamese diacritics).
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      decodeURIComponent(
        atob(payloadB64)
          .split("")
          .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      ),
    ) as DecodedAccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Quick-access shortcut for the most common need — `usr_id` (ULID) to
 * scope per-user IndexedDB on cold start before fetchMe resolves.
 */
export function getCachedUserIdFromToken(): string | null {
  return decodeAccessToken()?.usr_id ?? null;
}
