import { SocketStatus } from "@/components/providers/SocketProvider";
import { parseDate } from "@internationalized/date";
import { ClipboardEvent } from "react";

class Helpers {
  static getDefaultDate = () => {
    const today = new Date();
    const eighteenYearsAgo = new Date(
      today.getFullYear(),
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

