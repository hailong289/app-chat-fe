import { SocketStatus } from "@/components/providers/SocketProvider";
import { parseDate, CalendarDate } from "@internationalized/date";
import { ClipboardEvent } from "react";
import CryptoJS from "crypto-js";

class Helpers {
  static getDefaultDate = (): CalendarDate => {
    const today = new Date();
    const eighteenYearsAgo = new Date(
      today.getFullYear() - 18,
      today.getMonth(),
      today.getDate()
    );
    return parseDate(eighteenYearsAgo.toISOString().split("T")[0]);
  };
  public static readonly getSocketStatusMessage = (
    status: SocketStatus
  ): { description: string; color: string } => {
    switch (status) {
      case "idle":
        return { description: "Chưa kết nối tới máy chủ.", color: "default" };
      case "connecting":
        return { description: "Đang kết nối tới máy chủ...", color: "warning" };
      case "connected":
        return { description: "Đã kết nối thành công!", color: "success" };
      case "error":
        return {
          description: "Kết nối thất bại. Vui lòng thử lại hoặc kiểm tra mạng.",
          color: "danger",
        };
      default:
        return {
          description: "Không xác định trạng thái kết nối.",
          color: "secondary",
        };
    }
  };

  static enCryptUserInfo = (userInfo: any) => {
    const userInfoString = JSON.stringify(userInfo);
    const encryptedUserInfo = CryptoJS.AES.encrypt(
      userInfoString,
      process.env.NEXT_PUBLIC_SECRET_KEY || "123456"
    ).toString();
    return encryptedUserInfo;
  };

  static decryptUserInfo = (encryptedUserInfo: string) => {
    try {
      if (!encryptedUserInfo) return null;

      let cleanStr = decodeURIComponent(encryptedUserInfo);

      if (
        (cleanStr.startsWith('"') && cleanStr.endsWith('"')) ||
        (cleanStr.startsWith("'") && cleanStr.endsWith("'"))
      ) {
        cleanStr = cleanStr.slice(1, -1);
      }
      cleanStr = cleanStr.replace(/ /g, "+");
      const bytes = CryptoJS.AES.decrypt(
        cleanStr,
        process.env.NEXT_PUBLIC_SECRET_KEY || "123456"
      );
      const originalText = bytes.toString(CryptoJS.enc.Utf8);
      if (!originalText) {
        console.error(
          "Giải mã ra chuỗi rỗng (thường do sai Key hoặc sai cấu trúc Base64)"
        );
        return null;
      }

      return JSON.parse(originalText);
    } catch (error) {
      // Log chi tiết để biết lỗi ở đâu
      console.error("Lỗi nghiêm trọng trong decryptUserInfo:", error);
      // Trả về null để UI không bị crash
      return null;
    }
  };
  static updateURLParams = (key: string, value: string) => {
    // 1. Lấy URL hiện tại
    const url = new URL(window.location.href);

    // 2. Cập nhật hoặc thêm param mới
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key); // Xóa nếu không có giá trị
    }

    // 3. Thay đổi URL trên trình duyệt mà KHÔNG reload
    // Tham số: (state object, title, new_url)
    window.history.replaceState(null, "", url.toString());
  };

  static formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };
}

export function isTauriRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).__TAURI__ || !!(window as any).__TAURI_INTERNALS__;
}

/** Định dạng ms thành chuỗi "X ngày Y giờ", "X phút Y giây", ... */
export function formatTimeUntil(ms: number): string {
  if (ms <= 0 || !Number.isFinite(ms)) return "0 giây";
  const s = Math.floor(ms / 1000) % 60;
  const m = Math.floor(ms / 60_000) % 60;
  const h = Math.floor(ms / 3600_000) % 24;
  const d = Math.floor(ms / 86400_000);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ngày`);
  if (h > 0) parts.push(`${h} giờ`);
  if (m > 0) parts.push(`${m} phút`);
  if (s > 0 || parts.length === 0) parts.push(`${s} giây`);
  return parts.join(" ");
}

/** Số ms còn lại đến giờ bắt đầu; 0 nếu đã bắt đầu hoặc không có startTime. */
export function getMsUntilStart(startTime?: string): number {
  if (!startTime) return 0;
  const now = Date.now();
  const start = new Date(startTime).getTime();
  return Math.max(0, start - now);
}

/** Định dạng ISO date string sang vi-VN (ngày/tháng/năm giờ:phút). */
export function formatDateTime(iso?: string): string {
  if (!iso) return "Không giới hạn";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Không xác định";
  }
}

export type QuizStatusColor = "success" | "warning" | "danger" | "default";

export interface QuizStatusResult {
  label: string;
  color: QuizStatusColor;
}

/** Trạng thái quiz theo thời gian bắt đầu/kết thúc. */
export function getQuizStatus(quiz: {
  quiz_startTime?: string;
  quiz_endTime?: string;
  quiz_status?: string;
}): QuizStatusResult {
  const now = new Date();
  if (quiz.quiz_startTime && new Date(quiz.quiz_startTime) > now) {
    return { label: "Chưa bắt đầu", color: "warning" };
  }
  if (quiz.quiz_endTime && new Date(quiz.quiz_endTime) < now) {
    return { label: "Đã kết thúc", color: "danger" };
  }
  if (quiz.quiz_status === "active") {
    return { label: "Đang mở", color: "success" };
  }
  return { label: "Bản nháp", color: "default" };
}

/** Số ms tới mốc chuyển trạng thái tiếp theo (bắt đầu hoặc kết thúc); Infinity nếu không còn. */
export function getMsUntilNextTransition(quiz: {
  quiz_startTime?: string;
  quiz_endTime?: string;
}): number {
  const now = Date.now();
  const start = quiz.quiz_startTime ? new Date(quiz.quiz_startTime).getTime() : 0;
  const end = quiz.quiz_endTime ? new Date(quiz.quiz_endTime).getTime() : 0;
  if (start && now < start) return start - now;
  if (end && now < end) return end - now;
  return Infinity;
}

export default Helpers;

export type ToastElements = {
  base: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  loadingComponent: string;
  content: string;
  progressTrack: string;
  progressIndicator: string;
  closeButton: string;
  closeIcon: string;
};

export function getToastElements(status: SocketStatus): ToastElements {
  const { description, color } = Helpers.getSocketStatusMessage(status);

  let icon = "ℹ️";
  let toastType: "success" | "error" | "info" | "loading" = "info";

  if (status === "connected") {
    icon = "✅";
    toastType = "success";
  } else if (status === "error") {
    icon = "❌";
    toastType = "error";
  } else if (status === "connecting") {
    icon = "⏳";
    toastType = "loading";
  }

  let title = "Thông báo";
  if (status === "connected") {
    title = "Kết nối thành công";
  } else if (status === "error") {
    title = "Kết nối thất bại";
  } else if (status === "connecting") {
    title = "Đang kết nối...";
  } else if (status === "idle") {
    title = "Chưa kết nối";
  }

  return {
    base: "toast-container",
    title: title,
    description: description,
    color: color,
    icon: icon,
    loadingComponent: toastType === "loading" ? "Loading spinner..." : "",
    content: "toast-content",
    progressTrack: "toast-progress-track",
    progressIndicator: "toast-progress-indicator",
    closeButton: "toast-close-btn",
    closeIcon: "✖️",
  };
}
