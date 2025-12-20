// Helper functions for URL detection and extraction

/**
 * Regex để phát hiện URL trong text
 */
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

/**
 * Phát hiện URL đầu tiên trong text
 */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Phát hiện tất cả URL trong text
 */
export function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Kiểm tra xem text có chứa URL không
 */
export function containsUrl(text: string): boolean {
  return URL_REGEX.test(text);
}

/**
 * Tách text thành các phần (text và URL)
 */
export function parseTextWithUrls(
  text: string
): Array<{ type: "text" | "url"; content: string }> {
  const parts: Array<{ type: "text" | "url"; content: string }> = [];
  let lastIndex = 0;

  const regex = new RegExp(URL_REGEX);
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add URL
    parts.push({
      type: "url",
      content: match[0],
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return parts;
}
