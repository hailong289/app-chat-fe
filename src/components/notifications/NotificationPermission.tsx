"use client";
import { useEffect, useState } from "react";
import { useFirebase } from "@/components/providers/firebase.provider";
import { BellIcon, XMarkIcon } from "@heroicons/react/24/outline";

function isTauriRuntime() {
  return typeof window !== "undefined" && !!(window as any).__TAURI__;
}

type PromptMode = "request" | "denied" | null;

export default function NotificationPermission() {
  const { requestPermission, token, messaging } = useFirebase();
  const [promptMode, setPromptMode] = useState<PromptMode>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (globalThis.window === undefined) return;

    // Không có Firebase messaging (không socket / FCM không khả dụng)
    if (!messaging) return;

    let timeoutId: NodeJS.Timeout;

    const checkPermission = async () => {
      const dismissed = localStorage.getItem("notification-prompt-dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
        return;
      }

      const permission = Notification.permission;

      const savedToken = localStorage.getItem("fcm-token");
      if (token || savedToken) return;

      if (permission === "default") {
        timeoutId = setTimeout(() => setPromptMode("request"), 3000);
      } else if (permission === "granted") {
        await requestPermission();
      } else if (permission === "denied") {
        setPromptMode("denied");
      }
    };

    checkPermission();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [token, requestPermission, messaging]);

  const handleAllow = async () => {
    await requestPermission();
    setPromptMode(null);
  };

  const handleDismiss = () => {
    setPromptMode(null);
    localStorage.setItem("notification-prompt-dismissed", "true");
    setIsDismissed(true);
  };

  const handleLater = () => {
    setPromptMode(null);
  };

  const handleOpenSettings = () => {
    if (isTauriRuntime()) {
      // Tauri: mở Windows notification settings
      const tauri = (window as any).__TAURI__;
      tauri?.shell?.open?.("ms-settings:notifications").catch(() => {
        tauri?.opener?.open?.("ms-settings:notifications");
      });
    } else {
      // Browser: hướng dẫn bật lại trong địa chỉ URL (không thể mở settings tự động)
      window.open(
        "https://support.google.com/chrome/answer/3220216",
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  if (!promptMode || isDismissed) return null;

  return (
    <>
      {/* Overlay */}
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-200 cursor-default border-0 p-0 m-0"
        onClick={handleLater}
        aria-label="Đóng popup thông báo"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90%] max-w-md animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">

          {promptMode === "denied" ? (
            <>
              {/* Header — denied */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 relative">
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                  aria-label="Đóng"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <BellIcon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-white">
                    <h3 className="text-xl font-bold">Thông báo bị chặn</h3>
                    <p className="text-sm text-white/90 mt-1">
                      Bạn đã từ chối quyền thông báo trước đó
                    </p>
                  </div>
                </div>
              </div>

              {/* Content — denied */}
              <div className="p-6">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  {isTauriRuntime()
                    ? "Để nhận thông báo, hãy vào Cài đặt Windows → System → Notifications và bật thông báo cho ứng dụng này."
                    : "Để nhận thông báo, hãy click vào biểu tượng khóa (🔒) trên thanh địa chỉ trình duyệt → Notifications → Allow, rồi tải lại trang."}
                </p>
                <div className="space-y-2">
                  <button
                    onClick={handleOpenSettings}
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg"
                  >
                    {isTauriRuntime() ? "Mở Cài đặt Thông báo" : "Xem hướng dẫn"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="w-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
                  >
                    Không hiện lại
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Header — request */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 relative">
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                  aria-label="Đóng"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <BellIcon className="w-8 h-8 text-white" />
                  </div>
                  <div className="text-white">
                    <h3 className="text-xl font-bold">Bật thông báo</h3>
                    <p className="text-sm text-white/90 mt-1">
                      Không bỏ lỡ tin nhắn quan trọng
                    </p>
                  </div>
                </div>
              </div>

              {/* Content — request */}
              <div className="p-6">
                <div className="space-y-3 mb-6">
                  {[
                    "Nhận thông báo ngay khi có tin nhắn mới",
                    "Không bỏ lỡ tin nhắn quan trọng khi đang làm việc khác",
                    "Bạn có thể tắt bất cứ lúc nào trong cài đặt",
                  ].map((text) => (
                    <div key={text} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-green-600 dark:text-green-400 text-sm">✓</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{text}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleAllow}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                  >
                    Cho phép thông báo
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={handleLater}
                      className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
                    >
                      Để sau
                    </button>
                    <button
                      onClick={handleDismiss}
                      className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
                    >
                      Không hiện lại
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                  Thông báo sẽ được gửi ngay cả khi bạn đang không mở ứng dụng
                </p>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}
