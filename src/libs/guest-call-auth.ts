const GUEST_TOKEN_KEY = "guest_call_token";
const GUEST_META_KEY = "guest_call_meta";
const GUEST_PENDING_KEY = "guest_call_pending";

/** Guest invite links are only supported for SFU (group) calls. */
export const GUEST_CALL_SUPPORTED_MODE = "sfu" as const;

export function isGuestCallSupportedMode(
  mode?: string | null,
): mode is typeof GUEST_CALL_SUPPORTED_MODE {
  return mode === GUEST_CALL_SUPPORTED_MODE;
}

export interface GuestCallSessionMeta {
  guestId: string;
  roomId: string;
  callId: string;
  callType: "video" | "audio";
  callMode: "p2p" | "sfu";
  guestName: string;
  expiresAt?: string;
}

export interface GuestCallPendingInvite {
  token: string;
  guestId: string;
  roomId: string;
  callId: string;
  callType: "video" | "audio";
  callMode: "p2p" | "sfu";
  expiresAt?: string;
}

function stripGuestTokenFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("guestToken")) return;
  url.searchParams.delete("guestToken");
  const next =
    url.pathname + (url.search ? url.search : "") + (url.hash || "");
  window.history.replaceState(window.history.state, "", next);
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isGuestCallMode(): boolean {
  if (typeof window === "undefined") return false;
  return !!sessionStorage.getItem(GUEST_TOKEN_KEY);
}

/** Active guest session for an SFU call (guest links are SFU-only). */
export function isGuestSfuCallMode(): boolean {
  if (!isGuestCallMode()) return false;
  return isGuestCallSupportedMode(getGuestCallMeta()?.callMode);
}

export function hasGuestSfuCallPending(): boolean {
  const pending = getGuestCallPending();
  return !!pending && isGuestCallSupportedMode(pending.callMode);
}

export function getGuestCallToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(GUEST_TOKEN_KEY);
}

export function getGuestCallMeta(): GuestCallSessionMeta | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(GUEST_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestCallSessionMeta;
  } catch {
    return null;
  }
}

export function setGuestCallSession(token: string, meta: GuestCallSessionMeta) {
  sessionStorage.setItem(GUEST_TOKEN_KEY, token);
  sessionStorage.setItem(GUEST_META_KEY, JSON.stringify(meta));
  window.dispatchEvent(new Event("guest-call-session-changed"));
}

export function clearGuestCallSession() {
  sessionStorage.removeItem(GUEST_TOKEN_KEY);
  sessionStorage.removeItem(GUEST_META_KEY);
  sessionStorage.removeItem(GUEST_PENDING_KEY);
  window.dispatchEvent(new Event("guest-call-session-changed"));
}

function parseGuestTokenFromUrl(): GuestCallPendingInvite | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get("guestToken")?.trim();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const jti = typeof payload?.jti === "string" ? payload.jti : "";
  const roomId =
    (typeof payload?.roomId === "string" && payload.roomId) ||
    params.get("roomId") ||
    "";
  const callId =
    (typeof payload?.callId === "string" && payload.callId) ||
    params.get("callId") ||
    "";
  const callType =
    (payload?.callType === "video" || payload?.callType === "audio"
      ? payload.callType
      : params.get("callType") === "video"
        ? "video"
        : "audio") as "video" | "audio";
  const callMode =
    payload?.callMode === "sfu" || params.get("callMode") === "sfu"
      ? ("sfu" as const)
      : null;

  const expiresAt =
    typeof payload?.exp === "number"
      ? new Date(payload.exp * 1000).toISOString()
      : undefined;

  if (!roomId || !callId || !jti || !callMode) return null;

  return {
    token,
    guestId: `guest:${jti}`,
    roomId,
    callId,
    callType,
    callMode,
    expiresAt,
  };
}

export function getGuestCallPending(): GuestCallPendingInvite | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(GUEST_PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GuestCallPendingInvite;
  } catch {
    return null;
  }
}

export function hasGuestCallPending(): boolean {
  return !!getGuestCallPending();
}

function setGuestCallPending(invite: GuestCallPendingInvite) {
  sessionStorage.setItem(GUEST_PENDING_KEY, JSON.stringify(invite));
  window.dispatchEvent(new Event("guest-call-session-changed"));
}

export function clearGuestCallPending() {
  sessionStorage.removeItem(GUEST_PENDING_KEY);
  window.dispatchEvent(new Event("guest-call-session-changed"));
}

/** Parse `?guestToken=` and store pending invite until guest enters a name. */
export function applyGuestCallTokenFromUrl(): boolean {
  const invite = parseGuestTokenFromUrl();
  if (!invite) return false;

  setGuestCallPending(invite);
  stripGuestTokenFromUrl();
  return true;
}

export function confirmGuestCallWithName(guestName: string): boolean {
  const pending = getGuestCallPending();
  const trimmed = guestName.trim();
  if (!pending || !trimmed || !isGuestCallSupportedMode(pending.callMode)) {
    return false;
  }

  setGuestCallSession(pending.token, {
    guestId: pending.guestId,
    roomId: pending.roomId,
    callId: pending.callId,
    callType: pending.callType,
    callMode: pending.callMode,
    guestName: trimmed,
    expiresAt: pending.expiresAt,
  });
  clearGuestCallPending();
  return true;
}

export function buildGuestUserFromSession(): {
  id: string;
  fullname: string;
  avatar?: string;
  isGuest: true;
} | null {
  const meta = getGuestCallMeta();
  if (!meta) return null;
  return {
    id: meta.guestId,
    fullname: meta.guestName,
    isGuest: true,
  };
}
