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
