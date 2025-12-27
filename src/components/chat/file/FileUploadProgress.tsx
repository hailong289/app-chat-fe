import { FilePreview } from "@/store/types/message.state";
import { Progress } from "@heroui/react";
import { useTranslation } from "react-i18next";

interface FileUploadProgressProps {
  attachment: FilePreview;
}

export const FileUploadProgress = ({ attachment }: FileUploadProgressProps) => {
  const { t } = useTranslation();
  const { status, uploadProgress = 0, name } = attachment;

  if (status === "uploaded" || status === "pending") {
    return null; // Không hiển thị gì nếu đã upload xong hoặc chưa bắt đầu
  }

  return (
    <div className="mt-2 p-2 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600 truncate flex-1">{name}</span>
        <span className="text-xs text-gray-500 ml-2">{uploadProgress}%</span>
      </div>
      <Progress
        size="sm"
        value={uploadProgress}
        color={status === "failed" ? "danger" : "primary"}
        classNames={{
          indicator: status === "uploading" ? "bg-primary" : "bg-danger",
        }}
      />
      {status === "failed" && (
        <p className="text-xs text-red-500 mt-1">
          {t("chat.file.preview.failed")}
        </p>
      )}
    </div>
  );
};
