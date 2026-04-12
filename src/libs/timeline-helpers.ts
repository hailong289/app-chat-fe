/**
 * Timeline helpers for grouping messages by date
 */

import { TFunction } from "i18next";
import i18n from "../i18n";

export type MessageGroup<T = any> = {
  dateLabel: string; // "Hôm nay", "Hôm qua", "DD/MM/YYYY"
  messages: T[]; 
  isNewMessageDivider?: boolean; // Đánh dấu đây là divider "Tin nhắn mới"
  newMessageIndex?: number; // Vị trí tin nhắn mới trong group này
};

/**
 * Format date label in Vietnamese
 */
export function formatDateLabel(date: Date, t?: TFunction): string {
  const translate = t || i18n.t;
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
    return translate("chat.messages.date.today");
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return translate("chat.messages.date.yesterday");
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
  t?: TFunction
): MessageGroup<T>[] {
  const translate = t || i18n.t;
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

  // Use a stable sort for keys
  const sortedDateKeys = Object.keys(groups).sort((a, b) => {
    // Simple string comparison works for YYYY-MM-DD format if padded correctly,
    // but our key is YYYY-M-D (unpadded).
    // So we must parse.
    const [yearA, monthA, dayA] = a.split("-").map(Number);
    const [yearB, monthB, dayB] = b.split("-").map(Number);

    if (yearA !== yearB) return yearA - yearB;
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
  });

  for (const dateKey of sortedDateKeys) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month, day);
    const groupMessages = groups[dateKey];

    // Ensure messages within group are sorted by createdAt
    groupMessages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

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
 * Slice groups to get last N messages while preserving structure
 */
export function sliceVisibleGroups<T>(
  groups: MessageGroup<T>[],
  count: number
): MessageGroup<T>[] {
  if (!groups || groups.length === 0) return [];
  if (count <= 0) return [];

  let currentCount = 0;
  const result: MessageGroup<T>[] = [];

  // Iterate from end to start
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    const needed = count - currentCount;

    if (needed <= 0) {
      break;
    }

    if (group.messages.length <= needed) {
      // Take whole group
      result.unshift(group);
      currentCount += group.messages.length;
    } else {
      // Take slice of group (from end)
      const slicedMessages = group.messages.slice(-needed);
      const startIndex = group.messages.length - needed;
      
      let newMessageIndex = undefined;
      if (group.newMessageIndex !== undefined) {
         if (group.newMessageIndex >= startIndex) {
             newMessageIndex = group.newMessageIndex - startIndex;
         }
      }

      result.unshift({
        ...group,
        messages: slicedMessages,
        newMessageIndex,
      });
      currentCount += slicedMessages.length;
    }
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
