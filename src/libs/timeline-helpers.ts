/**
 * Timeline helpers for grouping messages by date
 */

export type MessageGroup = {
  dateLabel: string; // "Hôm nay", "Hôm qua", "DD/MM/YYYY"
  messages: any[]; // Your MessageType
};

/**
 * Format date label in Vietnamese
 */
export function formatDateLabel(date: Date): string {
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
    return "Hôm nay";
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return "Hôm qua";
  } else {
    // Format as DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
}

/**
 * Group messages by date
 */
export function groupMessagesByDate<T extends { createdAt: string }>(
  messages: T[]
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

  // Convert to array and sort by date (oldest first)
  return Object.keys(groups)
    .sort((a, b) => {
      const [yearA, monthA, dayA] = a.split("-").map(Number);
      const [yearB, monthB, dayB] = b.split("-").map(Number);
      const dateA = new Date(yearA, monthA, dayA);
      const dateB = new Date(yearB, monthB, dayB);
      return dateA.getTime() - dateB.getTime();
    })
    .map((dateKey) => {
      const [year, month, day] = dateKey.split("-").map(Number);
      const date = new Date(year, month, day);
      return {
        dateLabel: formatDateLabel(date),
        messages: groups[dateKey],
      };
    });
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
