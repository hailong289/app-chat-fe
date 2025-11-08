"use client";

import { toast } from "@/store/useToastStore";
import { Button } from "@heroui/react";

/**
 * Component demo để test Toast
 * Có thể xóa sau khi đã test xong
 */
export default function ToastDemo() {
  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2">
      <Button
        size="sm"
        color="success"
        onClick={() => toast.success("Thao tác thành công!", "Thành công")}
      >
        Success Toast
      </Button>

      <Button
        size="sm"
        color="danger"
        onClick={() => toast.error("Đã xảy ra lỗi!", "Lỗi")}
      >
        Error Toast
      </Button>

      <Button
        size="sm"
        color="warning"
        onClick={() => toast.warning("Cảnh báo quan trọng!", "Cảnh báo")}
      >
        Warning Toast
      </Button>

      <Button
        size="sm"
        color="primary"
        onClick={() => toast.info("Thông tin hữu ích", "Thông tin")}
      >
        Info Toast
      </Button>

      <Button
        size="sm"
        variant="flat"
        onClick={() => {
          toast.custom({
            type: "info",
            title: "Có action",
            message: "Toast này có nút action",
            action: {
              label: "Thử ngay",
              onClick: () => alert("Clicked!"),
            },
          });
        }}
      >
        Toast with Action
      </Button>
    </div>
  );
}
