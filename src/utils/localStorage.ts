import { db } from "@/libs/db";

/**
 * Keys preserved across logout. User preferences that aren't tied to
 * the account — flushing them on logout would feel like the app
 * "forgot the user's settings" between sessions on the same device.
 */
const LOGOUT_PRESERVE_KEYS = new Set([
  "i18nextLng", // language preference
  "theme", // light/dark mode
]);

/**
 * Clear all localStorage data when user logs out.
 *
 * Strategy: enumerate ALL keys + filter out the preserve list. This
 * catches dynamic keys we might add later (socket_cid_*, fcm-token,
 * call_handled_*, etc.) without having to maintain a static list.
 *
 * Zustand persist stores re-write themselves whenever set() runs, so
 * the order matters: Zustand stores must be `clearStorage()`'d via
 * their own API (handled in useAuthStore.logout()) — this function
 * is the catch-all for keys not owned by a Zustand store.
 *
 * ⚠️ IndexedDB cleared separately in useAuthStore.logout() via
 * Dexie.delete().
 */
export function clearAllLocalStorage() {
  // Snapshot the keys array — removeItem mutates localStorage so we
  // can't iterate live.
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }
  for (const key of keys) {
    if (!LOGOUT_PRESERVE_KEYS.has(key)) {
      localStorage.removeItem(key);
    }
  }
}

/**
 * Clear specific localStorage keys (for selective cleanup)
 */
export function clearLocalStorageKeys(keys: string[]) {
  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
}

export async function deleteOldMessagesKeepLatest(limit = 2000) {
  // Đếm tổng trước
  const total = await db.messages.count();
  if (total <= limit) return;

  const toDelete = total - limit;

  // Lấy danh sách id cần xoá (cũ nhất)
  const oldIds = await db.messages
    .orderBy("createdAt")
    .limit(toDelete)
    .primaryKeys();

  if (oldIds.length > 0) {
    await db.messages.bulkDelete(oldIds);
  }
}
