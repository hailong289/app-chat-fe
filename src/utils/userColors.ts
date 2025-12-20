// utils/userColors.ts

// Bộ màu pixel-art style
export const USER_COLORS = [
  "#1a1c2c",
  "#5d275d",
  "#b13e53",
  "#ef7d57",
  "#ffcd75",
  "#a7f070",
  "#38b764",
  "#257179",
  "#29366f",
  "#3b5dc9",
  "#41a6f6",
  "#73eff7",
  "#f4f4f4",
  "#94b0c2",
  "#566c86",
  "#333c57",
] as const;

export type UserColor = (typeof USER_COLORS)[number];

/**
 * Hash string (userId, email, ...) thành 1 index màu ổn định.
 * User nào cũng sẽ luôn ra cùng 1 màu, kể cả reload.
 */
export function getUserColor(userId: string): UserColor {
  if (!userId) {
    // fallback nhẹ nếu thiếu id
    return USER_COLORS[0];
  }

  let hash = 0;

  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0; // ép về 32-bit int
  }

  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

/**
 * Nếu cần random màu (ví dụ cho guest chưa có id).
 */
export function getRandomUserColor(): UserColor {
  const index = Math.floor(Math.random() * USER_COLORS.length);
  return USER_COLORS[index];
}
