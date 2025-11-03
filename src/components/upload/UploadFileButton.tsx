"use client";

import { useRef, useState } from "react";
import { Button, Spinner, Progress } from "@heroui/react";
import { CloudArrowUpIcon } from "@heroicons/react/24/solid";

type UploadFileButtonProps = {
  /** Service upload bạn muốn dùng (ví dụ: UploadService.uploadSingle, uploadMultiple...) */
  service: (
    fileOrFiles: File | File[],
    folder?: string,
    options?: any
  ) => Promise<any>;
  /** Callback sau khi upload xong */
  onDone: (urls: string[]) => void;
  /** Callback khi lỗi */
  onError?: (err: string) => void;
  /** Thư mục lưu backend */
  folder?: string;
  /** Có cho phép chọn nhiều file không */
  multiple?: boolean;
  /** MIME type cho phép */
  accept?: string;
  /** Text hiển thị trên nút */
  label?: string;
  /** Icon hiển thị ban đầu (mặc định là UploadCloud) */
  icon?: React.ReactNode;
  /** Disable button */
  disabled?: boolean;
  /** Class tuỳ chỉnh */
  className?: string;
  /** Màu và kiểu button HeroUI */
  variant?:
    | "flat"
    | "solid"
    | "bordered"
    | "light"
    | "faded"
    | "shadow"
    | "ghost";
  color?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger";
};

export default function UploadFileButton({
  variant = "solid",
  color = "primary",
  service,
  onDone,
  onError,
  folder = "avatar",
  multiple = false,
  accept = "image/*,video/*",
  label = "Tải lên tệp",
  icon = <CloudArrowUpIcon className="w-4 h-4" />,
  disabled,
  className,
}: Readonly<UploadFileButtonProps>) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const openDialog = () => inputRef.current?.click();

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    try {
      setLoading(true);
      setProgress(0);

      const isMulti = multiple && files.length > 1;
      const payload = isMulti ? files : files[0];

      // ⚡ Nếu service hỗ trợ truyền onProgress
      const { data } = await service(payload, folder, {
        onProgress: (pct: number) => setProgress(pct),
      });

      // ✅ Chuẩn hóa kết quả lấy URL
      let urls: string[] = [];
      if (data?.metadata?.url) urls = [data.metadata.url];
      else if (data?.metadata?.urls) urls = data.metadata.urls;
      else if (data?.url) urls = [data.url];
      else if (Array.isArray(data))
        urls = data.map((d: any) => d.url).filter(Boolean);

      if (!urls.length) throw new Error("Không tìm thấy URL hợp lệ");

      onDone(urls);
    } catch (err: any) {
      console.error("❌ Upload error:", err);
      onError?.(err?.message || "Upload thất bại");
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button
        color={color}
        variant={variant}
        onPress={openDialog}
        isDisabled={loading || disabled}
        className={className}
        startContent={loading ? <Spinner size="sm" color="white" /> : icon}
      >
        {loading ? (
          <Progress
            aria-label="Tiến trình tải lên"
            size="sm"
            value={progress}
            color={color}
            showValueLabel
            className="w-full"
          />
        ) : (
          label
        )}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
}
