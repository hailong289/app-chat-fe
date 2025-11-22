/**
 * Kiểm tra xem ứng dụng có đang chạy trong Tauri không
 */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  
  // Kiểm tra Tauri globals
  return (
    typeof window !== "undefined" &&
    (typeof (window as any).__TAURI__ !== "undefined" ||
      typeof (window as any).__TAURI_INTERNALS__ !== "undefined" ||
      // Kiểm tra user agent
      navigator.userAgent.includes("Tauri") ||
      // Kiểm tra protocol (Tauri thường dùng custom protocol hoặc file://)
      window.location.protocol === "tauri:" ||
      window.location.protocol === "file:")
  );
}

/**
 * Kiểm tra xem service worker có khả dụng không
 */
export function isServiceWorkerSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "Notification" in window;
}

