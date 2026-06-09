/** Lấy message lỗi từ axios interceptor hoặc AxiosError gốc. */
export function getApiErrorMessage(
  error: unknown,
  fallback = "Đã có lỗi xảy ra",
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;

  const e = error as {
    message?: string;
    response?: { data?: { message?: string | string[] } };
  };

  if (typeof e.message === "string" && e.message.trim()) {
    return e.message;
  }

  const bodyMessage = e.response?.data?.message;
  if (typeof bodyMessage === "string" && bodyMessage.trim()) {
    return bodyMessage;
  }
  if (Array.isArray(bodyMessage) && bodyMessage.length > 0) {
    return bodyMessage.join(", ");
  }

  return fallback;
}
