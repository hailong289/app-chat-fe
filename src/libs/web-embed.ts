const WEB_EMBED_KEY = "ichat-web-embed";

/** WebView / RN: mở route với `?token=` — ẩn sidebar app (Header trái) */
export function markWebEmbedMode(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WEB_EMBED_KEY, "1");
  } catch {
    /* private mode */
  }
}

export function isWebEmbedMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(WEB_EMBED_KEY) === "1") return true;
    return new URLSearchParams(window.location.search).has("token");
  } catch {
    return false;
  }
}

export function isWebEmbedRoute(path: string | null): boolean {
  if (!path) return false;
  return (
    path === "/docs" ||
    path.startsWith("/docs/") ||
    path === "/flash-card" ||
    path.startsWith("/flash-card/") ||
    path === "/todo" ||
    path.startsWith("/todo/")
  );
}
