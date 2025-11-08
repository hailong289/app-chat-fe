"use client";
import { useEffect, useState } from "react";
import { useFirebase } from "@/components/providers/firebase.provider";
import { BellIcon, XMarkIcon } from "@heroicons/react/24/outline";

export default function NotificationPermission() {
  const { requestPermission, token } = useFirebase();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Kiểm tra xem đã có quyền thông báo chưa
    if (globalThis.window === undefined) return;

    const checkPermission = async () => {
      // Kiểm tra localStorage xem user đã dismiss chưa
      const dismissed = localStorage.getItem("notification-prompt-dismissed");
      if (dismissed === "true") {
        setIsDismissed(true);
        console.log("🔔 Notification prompt was dismissed by user");
        return;
      }

      // Kiểm tra quyền thông báo
      const permission = Notification.permission;

      // Nếu đã có token (FCM), không cần hiện prompt nữa
      const savedToken = localStorage.getItem("fcm-token");
      if (token || savedToken) {
        console.log("🔔 FCM token already exists, skipping prompt");
        return;
      }

      // Nếu chưa có quyền (default = chưa hỏi), hiển thị prompt sau 3 giây
      if (permission === "default") {
        setTimeout(() => {
          setShowPrompt(true);
          console.log("🔔 Showing notification permission prompt");
        }, 3000);
      } else if (permission === "granted") {
        console.log(
          "🔔 Notification permission granted but no token, requesting..."
        );
        // Có quyền nhưng chưa có token, thử lấy token
        await requestPermission();
      } else {
        console.log("🔔 Notification permission:", permission);
      }
    };

    checkPermission();
  }, [token, requestPermission]);

  const handleAllow = async () => {
    console.log("🔔 User clicked Allow");
    await requestPermission();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    console.log("🔔 User dismissed notification prompt permanently");
    setShowPrompt(false);
    localStorage.setItem("notification-prompt-dismissed", "true");
    setIsDismissed(true);
  };

  const handleLater = () => {
    console.log("🔔 User clicked Later");
    setShowPrompt(false);
    // Không lưu vào localStorage, sẽ hiện lại lần sau
  };

  if (!showPrompt || isDismissed) return null;

  return (
    <>
      {/* Overlay - Click to close */}
      <button
        type="button"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998] animate-in fade-in duration-200 cursor-default border-0 p-0 m-0"
        onClick={handleLater}
        aria-label="Đóng popup thông báo"
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[90%] max-w-md animate-in zoom-in-95 duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header với gradient */}
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

          {/* Content */}
          <div className="p-6">
            <div className="space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✓
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Nhận thông báo ngay khi có tin nhắn mới
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✓
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Không bỏ lỡ tin nhắn quan trọng khi đang làm việc khác
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 dark:text-green-400 text-sm">
                    ✓
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Bạn có thể tắt bất cứ lúc nào trong cài đặt
                </p>
              </div>
            </div>

            {/* Buttons */}
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
        </div>
      </div>
    </>
  );
}
