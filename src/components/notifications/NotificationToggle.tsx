"use client";
import { useFirebase } from "@/components/providers/firebase.provider";
import { useState, useEffect } from "react";
import useAlertStore from "@/store/useAlertStore";

// Simple SVG icons
const BellIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const BellOffIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
    />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

export default function NotificationToggle() {
  const { requestPermission, token } = useFirebase();
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (globalThis.window !== undefined) {
      setPermission(Notification.permission);
    }
  }, [token]);

  const handleToggle = async () => {
    if (permission === "granted") {
      useAlertStore.getState().showAlert({
        title: "Hướng dẫn",
        message:
          "Để tắt thông báo, vui lòng vào cài đặt trình duyệt:\nChrome: Cài đặt > Quyền riêng tư và bảo mật > Cài đặt trang web > Thông báo",
        type: "info",
      });
      return;
    }

    if (permission === "denied") {
      useAlertStore.getState().showAlert({
        title: "Hướng dẫn",
        message:
          "Bạn đã từ chối quyền thông báo. Để bật lại, vui lòng:\n1. Nhấp vào biểu tượng khóa/thông tin bên trái thanh địa chỉ\n2. Cho phép thông báo\n3. Tải lại trang",
        type: "warning",
      });
      return;
    }

    setIsLoading(true);
    try {
      await requestPermission();
      setPermission(Notification.permission);
    } catch (error) {
      console.error("Error requesting permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusInfo = () => {
    switch (permission) {
      case "granted":
        return {
          icon: <CheckIcon className="w-5 h-5" />,
          text: "Đã bật",
          color: "text-green-600 dark:text-green-400",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      case "denied":
        return {
          icon: <BellOffIcon className="w-5 h-5" />,
          text: "Đã tắt",
          color: "text-red-600 dark:text-red-400",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-800",
        };
      default:
        return {
          icon: <BellIcon className="w-5 h-5" />,
          text: "Chưa bật",
          color: "text-gray-600 dark:text-gray-400",
          bgColor: "bg-gray-50 dark:bg-gray-800",
          borderColor: "border-gray-200 dark:border-gray-700",
        };
    }
  };

  const status = getStatusInfo();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Thông báo trình duyệt
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Nhận thông báo ngay cả khi không mở ứng dụng
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
            ${status.bgColor} ${status.borderColor} ${status.color}
            hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed
            text-sm font-medium
          `}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            status.icon
          )}
          {status.text}
        </button>
      </div>

      {/* Token info (for debugging) */}
      {token && (
        <details className="text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            FCM Token (nhấp để xem)
          </summary>
          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
            {token}
          </pre>
        </details>
      )}

      {permission === "denied" && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Lưu ý:</strong> Bạn đã từ chối quyền thông báo. Để bật lại:
          </p>
          <ol className="text-xs text-amber-700 dark:text-amber-300 mt-2 ml-4 list-decimal space-y-1">
            <li>Nhấp vào biểu tượng khóa/thông tin bên trái thanh địa chỉ</li>
            <li>Tìm mục &quot;Thông báo&quot; và chọn &quot;Cho phép&quot;</li>
            <li>Tải lại trang để áp dụng thay đổi</li>
          </ol>
        </div>
      )}
    </div>
  );
}
