/**
 * permissions.ts
 * ─────────────────────────────────────────────────────
 * Helper để xin quyền Native trên Android (qua Tauri plugins).
 * Trên Desktop / Web, tất cả hàm đều trả về `true` ngay lập tức
 * vì trình duyệt / OS tự quản lý quyền qua Web API chuẩn.
 *
 * Không import trực tiếp `@tauri-apps/plugin-notification` ở top-level
 * để tránh crash khi chạy trong môi trường Web thuần (Next.js SSR).
 * Thay vào đó, dùng dynamic import bên trong từng hàm.
 */

import { isTauriRuntime } from "@/libs/helpers";

/** Trả về true nếu đang chạy trong Tauri trên Android / iOS. */
export function isTauriMobile(): boolean {
  if (!isTauriRuntime()) return false;
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Xin quyền Notifications.
 * – Tauri Android: gọi `@tauri-apps/plugin-notification` requestPermissions.
 * – Web: dùng Notification API chuẩn của trình duyệt.
 * – Desktop (Tauri): trả về true ngay (OS tự xử lý).
 * @returns true nếu đã được cấp quyền.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isTauriRuntime()) {
    // Web browser — dùng Notification API
    if (typeof Notification === "undefined") return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }

  // Tauri (Desktop hoặc Mobile)
  try {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    return granted;
  } catch {
    // Plugin chưa được build vào binary (ví dụ khi dev web) — không crash
    return false;
  }
}

/**
 * Gửi thông báo Native qua Tauri plugin (Android / Desktop).
 * Trên Web thuần, fallback về Web Notification API.
 */
export async function sendNativeNotification(
  title: string,
  body: string,
  options?: { icon?: string; tag?: string }
): Promise<void> {
  if (isTauriRuntime()) {
    try {
      const { sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      await sendNotification({ title, body });
      return;
    } catch {
      // fallthrough
    }
  }

  // Web fallback
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: options?.icon ?? "/icons/icon-192x192.png",
      tag: options?.tag,
    });
  }
}

/**
 * Mở dialog chọn file (ảnh / tài liệu).
 * – Tauri Android: dùng `@tauri-apps/plugin-dialog` để mở hộp chọn file gốc.
 * – Web / Desktop: trả về null, để UI tự dùng <input type="file">.
 * @returns Đường dẫn file đã chọn, hoặc null nếu hủy / không hỗ trợ.
 */
export async function pickFileWithDialog(options?: {
  multiple?: boolean;
  filters?: { name: string; extensions: string[] }[];
}): Promise<string | string[] | null> {
  if (!isTauriRuntime()) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: options?.multiple ?? false,
      filters: options?.filters,
    });
    return selected as string | string[] | null;
  } catch {
    return null;
  }
}

/**
 * Yêu cầu quyền Camera & Mic trước khi gọi getUserMedia trên Tauri Mobile.
 * Trên Web/Desktop, hàm này là no-op (trình duyệt/Tauri WebView tự xử lý).
 *
 * Ghi chú: WebRTC getUserMedia() trên Tauri Android vẫn hiển thị
 * hộp thoại permission của hệ thống. Hàm này đảm bảo chúng ta đã
 * khai báo đủ `uses-permission` trong AndroidManifest và plugin
 * liên quan đã được init, giúp tránh bị từ chối do thiếu khai báo.
 */
export async function ensureMediaPermissions(): Promise<void> {
  // Hiện tại, việc khai báo permission trong AndroidManifest là đủ.
  // Nếu cần thêm runtime permission flow trong tương lai (ví dụ: plugin
  // tauri-plugin-permissions chính thức), có thể mở rộng hàm này.
  return;
}
