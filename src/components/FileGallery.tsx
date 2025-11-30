"use client";

import { FilePreview } from "@/store/types/message.state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Progress,
  Button,
} from "@heroui/react";
import { useState } from "react";
import {
  PlayCircleIcon,
  DocumentIcon,
  MusicalNoteIcon,
} from "@heroicons/react/24/solid";
import { DocumentTextIcon } from "@heroicons/react/16/solid";

// Chuẩn hoá loại file: ưu tiên mimeType -> kind
const normalizeKind = (
  file: FilePreview
): "photo" | "video" | "audio" | "pdf" | "file" => {
  const kind = file.kind?.toLowerCase() || "";
  const mimeType = file.mimeType?.toLowerCase() || "";

  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";

  if (kind === "image" || kind === "photo") return "photo";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  if (kind === "pdf") return "pdf";

  return "file";
};

interface FileGalleryProps {
  files: FilePreview[];
  className?: string;
}

export const FileGallery = ({ files, className = "" }: FileGalleryProps) => {
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);

  const handleFileClick = (file: FilePreview) => {
    if (file.status === "uploading") return; // không mở khi đang upload
    setSelectedFile(file);
  };

  const handleClose = () => {
    setSelectedFile(null);
  };

  const renderThumbnail = (file: FilePreview) => {
    const isUploading = file.status === "uploading";
    const isFailed = file.status === "failed";
    const kind = normalizeKind(file);

    return (
      <button
        type="button"
        key={file._id}
        className={`
          relative cursor-pointer rounded-lg overflow-hidden aspect-square
          border border-default-200 dark:border-default-600
          bg-default-100 dark:bg-default-50
          transition-transform hover:scale-[1.02]
          ${isUploading ? "opacity-70" : ""}
        `}
        onClick={() => !isUploading && handleFileClick(file)}
        aria-label={`Open file ${file.name}`}
      >
        {/* Thumbnail theo loại file */}
        {kind === "photo" && (
          <img
            src={file.url}
            alt={file.name}
            className="w-full h-full object-cover"
            style={
              file.width && file.height
                ? { aspectRatio: `${file.width} / ${file.height}` }
                : undefined
            }
          />
        )}

        {kind === "video" && (
          <div className="relative w-full h-full bg-black">
            <video
              src={file.url}
              className="w-full h-full object-cover"
              preload="metadata"
              style={
                file.width && file.height
                  ? { aspectRatio: `${file.width} / ${file.height}` }
                  : undefined
              }
            >
              <track kind="captions" />
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-black/35">
              <PlayCircleIcon className="w-10 h-10 text-white drop-shadow-lg" />
            </div>
          </div>
        )}

        {kind === "audio" && (
          <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <MusicalNoteIcon className="w-10 h-10 text-white" />
          </div>
        )}

        {kind === "pdf" && (
          <div className="w-full h-full bg-white flex flex-col items-center justify-center p-2">
            <DocumentTextIcon className="w-10 h-10 text-red-500 mb-1" />
            <p className="text-[10px] text-red-600 font-semibold truncate w-full px-2">
              {file.name}
            </p>
          </div>
        )}

        {kind === "file" && (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex flex-col items-center justify-center p-2">
            <DocumentIcon className="w-10 h-10 text-white mb-1" />
            <p className="text-[10px] text-white/90 text-center truncate w-full px-2">
              {file.name}
            </p>
          </div>
        )}

        {/* Upload Progress Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center px-3">
            <div className="w-full max-w-[90%]">
              <Progress
                size="sm"
                value={file.uploadProgress || 0}
                color="primary"
                className="mb-1"
              />
              <p className="text-[11px] text-white text-center">
                Đang tải lên… {file.uploadProgress || 0}%
              </p>
            </div>
          </div>
        )}

        {/* Failed Overlay */}
        {isFailed && (
          <div className="absolute inset-0 bg-red-500/80 flex items-center justify-center">
            <p className="text-[11px] text-white font-semibold">
              Upload thất bại
            </p>
          </div>
        )}

        {/* File Size Badge */}
        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
          {formatFileSize(file.size)}
        </div>
      </button>
    );
  };

  return (
    <>
      {/* Gallery Grid */}
      <div className={`grid grid-cols-3 gap-2 ${className}`}>
        {files.map((file) => renderThumbnail(file))}
      </div>

      {/* Modal preview */}
      <Modal
        isOpen={!!selectedFile}
        onClose={handleClose}
        size="3xl"
        scrollBehavior="inside"
        classNames={{
          base: "bg-background",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 border-b border-default-200">
            <h3 className="text-lg font-semibold truncate">
              {selectedFile?.name}
            </h3>
            <p className="text-sm text-default-500">
              {selectedFile && formatFileSize(selectedFile.size)} •{" "}
              {selectedFile?.mimeType || selectedFile?.kind}
            </p>
          </ModalHeader>

          <ModalBody className="pb-6">
            {selectedFile && (
              <div className="w-full">
                {/* Upload Progress */}
                {selectedFile.status === "uploading" && (
                  <div className="mb-4 p-4 rounded-lg bg-primary-50 dark:bg-primary-100/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-primary-700 dark:text-primary-200">
                        Đang tải lên…
                      </span>
                      <span className="text-sm text-primary-600 dark:text-primary-200">
                        {selectedFile.uploadProgress || 0}%
                      </span>
                    </div>
                    <Progress
                      value={selectedFile.uploadProgress || 0}
                      color="primary"
                      size="md"
                    />
                  </div>
                )}

                {/* Failed Status */}
                {selectedFile.status === "failed" && (
                  <div className="mb-4 p-4 rounded-lg bg-danger-50 dark:bg-danger-100/10">
                    <p className="text-sm font-medium text-danger-700 dark:text-danger-200">
                      ❌ Upload thất bại. Vui lòng thử lại.
                    </p>
                  </div>
                )}

                {/* File Preview */}
                {normalizeKind(selectedFile) === "photo" && (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    className="w-full h-auto rounded-lg object-contain"
                    style={
                      selectedFile.width && selectedFile.height
                        ? {
                            aspectRatio: `${selectedFile.width} / ${selectedFile.height}`,
                          }
                        : undefined
                    }
                  />
                )}

                {normalizeKind(selectedFile) === "video" && (
                  <video
                    src={selectedFile.url}
                    controls
                    className="w-full h-auto rounded-lg bg-black"
                    style={
                      selectedFile.width && selectedFile.height
                        ? {
                            aspectRatio: `${selectedFile.width} / ${selectedFile.height}`,
                          }
                        : undefined
                    }
                  >
                    <track kind="captions" />
                  </video>
                )}

                {normalizeKind(selectedFile) === "audio" && (
                  <div className="p-6 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                    <audio src={selectedFile.url} controls className="w-full">
                      <track kind="captions" />
                    </audio>
                  </div>
                )}

                {normalizeKind(selectedFile) === "pdf" && (
                  <iframe
                    src={selectedFile.url}
                    title={`PDF preview: ${selectedFile.name}`}
                    className="w-full h-[60vh] rounded-lg bg-white"
                  />
                )}

                {normalizeKind(selectedFile) === "file" && (
                  <div className="p-8 bg-default-100 dark:bg-default-50 rounded-lg text-center">
                    <DocumentIcon className="w-20 h-20 mx-auto text-default-400 mb-4" />
                    <p className="text-sm text-default-600 mb-3">
                      Không thể xem trước loại tệp này.
                    </p>
                    {selectedFile.status === "uploaded" && (
                      <Button
                        as="a"
                        href={selectedFile.uploadedUrl || selectedFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="primary"
                        className="font-medium"
                      >
                        Tải xuống
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};

// Helper function để handle number & MongoDB Long
function formatFileSize(
  size: number | { low: number; high: number; unsigned: boolean }
): string {
  let bytes: number;
  if (typeof size === "number") {
    bytes = size;
  } else {
    bytes = size.low + size.high * 0x100000000;
  }

  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
