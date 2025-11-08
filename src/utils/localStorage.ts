/**
 * Clear all localStorage data when user logs out
 * Bao gồm:
 * - Zustand persist stores (auth, room, counter, contact)
 * - Firebase tokens (fcm-token)
 * - Socket client ID (socket_client_id)
 * - Notification settings (notification-prompt-dismissed)
 *
 * ⚠️ Note: IndexedDB được xử lý riêng trong useAuthStore.logout()
 */
export function clearAllLocalStorage() {
  // Zustand persist stores
  const zustandStores = [
    "auth-storage",
    "room-storage",
    "counter-storage",
    "contact-storage",
    "message-storage",
  ];

  // Firebase & Notification
  const firebaseKeys = ["fcm-token", "notification-prompt-dismissed"];

  // Socket
  const socketKeys = ["socket_client_id"];

  // Clear all known keys
  for (const key of [...zustandStores, ...firebaseKeys, ...socketKeys]) {
    localStorage.removeItem(key);
  }

  console.log("🧹 [Cleanup] All localStorage data cleared");
}

/**
 * Clear specific localStorage keys (for selective cleanup)
 */
export function clearLocalStorageKeys(keys: string[]) {
  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
  console.log(`🧹 [Cleanup] Cleared keys: ${keys.join(", ")}`);
}
