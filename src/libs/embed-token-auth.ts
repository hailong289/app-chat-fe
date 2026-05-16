import useAuthStore from "@/store/useAuthStore";
import { openDbForUser } from "@/libs/db";
import { markWebEmbedMode } from "@/libs/web-embed";
import {
  decodeAccessToken,
  getCachedUserIdFromToken,
  tokenStorage,
} from "@/utils/tokenStorage";

function stripTokenQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("token")) return;
  url.searchParams.delete("token");
  const next =
    url.pathname + (url.search ? url.search : "") + (url.hash || "");
  window.history.replaceState(window.history.state, "", next);
}

/** Đọc `?token=`, bootstrap auth + embed mode, xóa token khỏi URL */
export function applyEmbedAccessTokenFromUrl(): void {
  if (typeof window === "undefined") return;

  const raw = new URLSearchParams(window.location.search).get("token");
  const token = raw?.trim();
  if (!token) return;

  markWebEmbedMode();
  tokenStorage.set(token);

  const payload = decodeAccessToken();
  const dateNow = Math.floor(Date.now() / 1000);
  const expSec =
    typeof payload?.exp === "number" && payload.exp > 0 ? payload.exp : 0;
  const expiresIn = expSec > dateNow ? expSec - dateNow : 0;

  useAuthStore.setState({
    isAuthenticated: true,
    tokens: {
      accessToken: token,
      refreshToken: null,
      expiresIn,
      expiredAt: expSec || dateNow + expiresIn,
    },
  });

  const userId = getCachedUserIdFromToken();
  if (userId) {
    try {
      openDbForUser(userId);
    } catch (err) {
      console.warn("[embed] openDbForUser failed", err);
    }
  }

  void useAuthStore.getState().fetchMe();
  stripTokenQueryParam();
}
