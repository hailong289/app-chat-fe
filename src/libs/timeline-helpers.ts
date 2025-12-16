/**
 * Timeline helpers for grouping messages by date
 */

import { TFunction } from "i18next";

export type MessageGroup = {
  dateLabel: string; // "Hôm nay", "Hôm qua", "DD/MM/YYYY"
  messages: any[]; // Your MessageType
  isNewMessageDivider?: boolean; // Đánh dấu đây là divider "Tin nhắn mới"
  newMessageIndex?: number; // Vị trí tin nhắn mới trong group này
};

/**
 * Format date label in Vietnamese
 */
export function formatDateLabel(date: Date, t: TFunction): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Reset hours for comparison
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const yesterdayOnly = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate()
  );

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return t("chat.messages.date.today");
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return t("chat.messages.date.yesterday");
  } else {
    // Format as DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

/**
 * Group messages by date and mark new messages
 */
export function groupMessagesByDate<
  T extends { id: string; createdAt: string }
>(
  messages: T[],
  lastReadId: string | null | undefined,
  t: TFunction
): MessageGroup[] {
  const groups: Record<string, T[]> = {};

  messages.forEach((msg) => {
    const date = new Date(msg.createdAt);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(msg);
  });

  // Tìm vị trí tin nhắn đã đọc cuối cùng
  let lastReadIndex = -1;
  if (lastReadId) {
    lastReadIndex = messages.findIndex((msg) => msg.id === lastReadId);
  }

  // Convert to array and sort by date (oldest first)
  const result: MessageGroup[] = [];

  const sortedDateKeys = Object.keys(groups).sort((a, b) => {
    const [yearA, monthA, dayA] = a.split("-").map(Number);
    const [yearB, monthB, dayB] = b.split("-").map(Number);
    const dateA = new Date(yearA, monthA, dayA);
    const dateB = new Date(yearB, monthB, dayB);
    return dateA.getTime() - dateB.getTime();
  });

  for (const dateKey of sortedDateKeys) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month, day);
    const groupMessages = groups[dateKey];

    // Kiểm tra xem group này có tin nhắn mới không
    let newMessageIndex = -1;
    if (lastReadIndex >= 0) {
      for (let idx = 0; idx < groupMessages.length; idx++) {
        const msg = groupMessages[idx];
        const msgIndex = messages.findIndex((m) => m.id === msg.id);
        if (msgIndex > lastReadIndex && newMessageIndex === -1) {
          newMessageIndex = idx;
        }
      }
    }

    result.push({
      dateLabel: formatDateLabel(date, t),
      messages: groupMessages,
      newMessageIndex: newMessageIndex >= 0 ? newMessageIndex : undefined,
    });
  }

  return result;
}

/**
 * Format time from ISO string to HH:MM
 */
export function formatMessageTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
