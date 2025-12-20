"use client";

import { useSocket } from "@/components/providers/SocketProvider";
import { toast } from "@/store/useToastStore";
import { useEffect, useRef } from "react";

export default function SocketStatusIndicator() {
  const { status, reconnectCount, lastError, forceReconnect } =
    useSocket("/chat");
  const prevStatusRef = useRef(status);
  const hasShownErrorRef = useRef(false);

  useEffect(() => {
    const prevStatus = prevStatusRef.current;

    // Connected - Show success toast
    if (status === "connected" && prevStatus !== "connected") {
      // Chỉ hiện toast khi reconnect thành công, không hiện khi connect lần đầu
      if (prevStatus === "reconnecting" || prevStatus === "error") {
        toast.success(
          "Đã kết nối lại thành công với server",
          "Kết nối khôi phục",
          3000
        );
      }
      hasShownErrorRef.current = false;
    }

    // Reconnecting - Show warning toast (chỉ 1 lần)
    if (status === "reconnecting" && prevStatus !== "reconnecting") {
      if (reconnectCount === 1) {
        toast.warning(
          "Đang cố gắng kết nối lại với server...",
          "Mất kết nối",
          0 // Không tự đóng
        );
      }
    }

    // Error - Show error toast
    if (
      status === "error" &&
      prevStatus !== "error" &&
      !hasShownErrorRef.current
    ) {
      toast.error(
        lastError ||
          "Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.",
        "Lỗi kết nối",
        0 // Không tự đóng
      );
      hasShownErrorRef.current = true;
    }

    prevStatusRef.current = status;
  }, [status, lastError, reconnectCount, forceReconnect]);

  // Component này không render gì, chỉ hiển thị toast
  return null;
}
