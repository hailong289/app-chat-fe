"use client";

import { FilePreview } from "@/store/types/message.state";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Progress,
  Button,
  Image,
  Tooltip,
} from "@heroui/react";
import { useState } from "react";
import {
  PlayCircleIcon,
  DocumentIcon,
  MusicalNoteIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";
import { motion, AnimatePresence } from "framer-motion";
import MiniAudioBubble from "./MiniAudioBubble";
import { DocumentTextIcon } from "@heroicons/react/16/solid";

// Helper: Normalize kind value (backend có thể trả "image" hoặc "photo")
const normalizeKind = (file: FilePreview): string => {
  const kind = file.kind?.toLowerCase() || "";
  const mimeType = file.mimeType?.toLowerCase() || "";

  // Ưu tiên mimeType (độ chính xác cao nhất)
  if (mimeType.startsWith("image/")) return "photo";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "pdf";

  // fallback theo kind
  if (kind === "image" || kind === "photo") return "photo";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  if (kind === "pdf") return "pdf";

  return "file"; // cuối cùng là file thường
};

interface CompactFileGalleryProps {
  files: FilePreview[];
  maxDisplay?: number; // Số file hiển thị tối đa, còn lại show "+N"
  className?: string;
}

export const CompactFileGallery = ({
  files,
  maxDisplay = 3,
  className = "",
}: CompactFileGalleryProps) => {
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);
  const [showAll, setShowAll] = useState(false); // Mặc định không hiện hết
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayFiles = showAll ? files : files.slice(0, maxDisplay);
  const remainingCount = files.length - maxDisplay;
  const hasMore = files.length > maxDisplay;

  const handleFileClick = (file: FilePreview, index: number) => {
    // Không mở modal nếu đang upload
    if (file.status === "uploading") return;
    setSelectedFile(file);
    setCurrentIndex(index);
  };

  const handleClose = () => {
    setSelectedFile(null);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      setSelectedFile(files[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      setSelectedFile(files[newIndex]);
    }
  };

  const renderCompactThumbnail = (file: FilePreview, index: number) => {
    const isUploading = file.status === "uploading";
    const isFailed = file.status === "failed";
    const fileKind = normalizeKind(file);

    // Xác định tỷ lệ khung hình dựa trên width/height nếu có
    const aspectRatio =
      file.width && file.height ? file.width / file.height : 1;

    // Xác định orientation và apply height phù hợp
    const isLandscape = aspectRatio > 1.2;
    const isPortrait = aspectRatio < 0.8;

    let heightClass = "h-24 sm:h-28 md:h-32"; // default square
    if (isPortrait) {
      heightClass = "h-32 sm:h-36 md:h-40"; // taller for portrait
    } else if (isLandscape) {
      heightClass = "h-20 sm:h-24 md:h-28"; // shorter for landscape
    }

    return (
      <div
        key={file._id}
        aria-label={`Open file ${file.name}`}
        className={`
          relative cursor-pointer rounded-xl overflow-hidden transition-all duration-200
          ${
            isFailed
              ? "border-2 border-red-500 shadow-red-500/50"
              : "border border-default-200 dark:border-default-600"
          }
          w-full ${heightClass} bg-default-100 dark:bg-default-50
        `}
      >
        {/* Thumbnail */}
        {fileKind === "photo" && (
          <Image
            src={file.url}
            alt={file.name}
            removeWrapper
            className="w-full h-full object-cover"
            style={
              file.width && file.height
                ? { aspectRatio: `${file.width} / ${file.height}` }
                : undefined
            }
            onClick={() => handleFileClick(file, index)}
          />
        )}

        {fileKind === "video" && (
          <button
            className="relative w-full h-full bg-black"
            onClick={() => handleFileClick(file, index)}
          >
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
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent to-black/40">
              <div className="bg-black/40 backdrop-blur-sm rounded-full p-3">
                <PlayCircleIcon className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
          </button>
        )}

        {fileKind === "audio" && (
          <div className="w-full h-full flex items-center justify-center bg-default-100 dark:bg-default-50">
            <MiniAudioBubble
              src={file.url}
              initialDuration={
                typeof file.duration === "number"
                  ? file.duration / 1000
                  : undefined
              }
              onPlayChange={() => {
                // nếu sau này muốn stop các audio khác -> xử lý ở parent
              }}
              className="w-full px-2"
            />
          </div>
        )}

        {fileKind === "pdf" && (
          <Tooltip content={file.name} placement="top">
            <button
              onClick={() => handleFileClick(file, index)}
              className="flex flex-col items-center justify-center gap-2 w-full h-full bg-default-100 dark:bg-default-50"
            >
              <DocumentTextIcon className="w-10 h-10 text-red-500" />
              <span className="text-xs font-semibold text-red-600">PDF</span>
            </button>
          </Tooltip>
        )}

        {fileKind === "file" && (
          <button
            onClick={() => handleFileClick(file, index)}
            className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"
          >
            <DocumentIcon className="w-10 h-10 text-white drop-shadow-lg" />
          </button>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-black/40 backdrop-blur-sm">
            <div className="flex gap-2 items-center">
              <Progress
                size="sm"
                value={file.uploadProgress || 0}
                color="primary"
                className="w-full"
              />
              <div className="text-xs font-medium text-primary-50">
                {file.uploadProgress || 0}%
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Compact Gallery Grid - Tự động responsive */}
      <div className={`grid gap-2 ${className}`}>
        <AnimatePresence mode="wait">
          {displayFiles.length === 1 && (
            <motion.div
              key="grid-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1"
            >
              {displayFiles.map((file, idx) => {
                const originalIndex = files.indexOf(file);
                return (
                  <motion.div
                    key={`file-${file._id}-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                  >
                    {renderCompactThumbnail(file, originalIndex)}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {displayFiles.length === 2 && (
            <motion.div
              key="grid-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-2 grid-cols-2"
            >
              {displayFiles.map((file, idx) => {
                const originalIndex = files.indexOf(file);
                return (
                  <motion.div
                    key={`file-${file._id}-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                  >
                    {renderCompactThumbnail(file, originalIndex)}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {displayFiles.length === 3 && (
            <motion.div
              key="grid-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid gap-2 grid-cols-2 grid-rows-2"
            >
              <motion.div
                key={displayFiles[0]._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="row-span-2"
              >
                {renderCompactThumbnail(
                  displayFiles[0],
                  files.indexOf(displayFiles[0])
                )}
              </motion.div>
              <motion.div
                key={displayFiles[1]._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                {renderCompactThumbnail(
                  displayFiles[1],
                  files.indexOf(displayFiles[1])
                )}
              </motion.div>
              <motion.div
                key={displayFiles[2]._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                {renderCompactThumbnail(
                  displayFiles[2],
                  files.indexOf(displayFiles[2])
                )}
              </motion.div>
            </motion.div>
          )}

          {displayFiles.length === 4 && (
            <motion.div
              key="grid-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-2 gap-2"
            >
              {displayFiles.map((file, idx) => {
                const originalIndex = files.indexOf(file);
                return (
                  <motion.div
                    key={`file-${file._id}-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: idx * 0.05 }}
                  >
                    {renderCompactThumbnail(file, originalIndex)}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {displayFiles.length > 4 && (
            <motion.div
              key="grid-many"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-3 sm:grid-cols-4 gap-2"
            >
              {displayFiles.map((file, idx) => {
                const originalIndex = files.indexOf(file);
                return (
                  <motion.div
                    key={`file-${file._id}-${idx}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(idx * 0.03, 0.3),
                    }}
                  >
                    {renderCompactThumbnail(file, originalIndex)}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nút "Xem thêm" và "Thu gọn" với animation */}
        <AnimatePresence mode="wait">
          {hasMore && !showAll && (
            <motion.div
              key="show-more"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => setShowAll(true)}
                className="mt-2 w-full"
              >
                Xem thêm {remainingCount} file
              </Button>
            </motion.div>
          )}

          {showAll && hasMore && (
            <motion.div
              key="collapse"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                size="sm"
                variant="flat"
                color="default"
                onPress={() => setShowAll(false)}
                className="mt-2 w-full"
              >
                Thu gọn
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal for full view */}
      <Modal
        isOpen={!!selectedFile}
        onClose={handleClose}
        size="full"
        scrollBehavior="inside"
        hideCloseButton
        classNames={{
          base: "overflow-hidden",
          wrapper: "items-center justify-center",
          backdrop: "bg-black/95 backdrop-blur-sm",
        }}
      >
        <ModalContent className="bg-gray-900/98 backdrop-blur-xl border border-white/10 shadow-2xl flex flex-col">
          {(onClose) => (
            <>
              {/* Header */}
              <ModalHeader className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-white truncate">
                    {selectedFile?.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {selectedFile && formatFileSize(selectedFile.size)} •{" "}
                    {currentIndex + 1} / {files.length}
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={handlePrevious}
                    isDisabled={currentIndex === 0}
                    className="text-gray-400 hover:text-white disabled:opacity-30 bg-transparent"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onPress={handleNext}
                    isDisabled={currentIndex === files.length - 1}
                    className="text-gray-400 hover:text-white disabled:opacity-30 bg-transparent"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="light"
                    onPress={onClose}
                    className="text-gray-400 hover:text-white bg-transparent"
                  >
                    ✕
                  </Button>
                </div>
              </ModalHeader>

              {/* Body */}
              <ModalBody className="p-0 flex-1 flex flex-col overflow-hidden">
                {selectedFile && (
                  <div className="flex flex-1 overflow-hidden">
                    {/* Viewer + status */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Upload / Error status */}
                      {selectedFile.status === "uploading" && (
                        <div className="p-4 bg-blue-500/10 border-b border-blue-500/40">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-100">
                              Đang tải lên...
                            </span>
                            <span className="text-sm text-blue-200 font-semibold">
                              {selectedFile.uploadProgress || 0}%
                            </span>
                          </div>
                          <Progress
                            value={selectedFile.uploadProgress || 0}
                            color="primary"
                            size="md"
                            className="h-2"
                          />
                        </div>
                      )}

                      {selectedFile.status === "failed" && (
                        <div className="p-4 bg-red-500/10 border-b border-red-500/40">
                          <p className="text-sm font-medium text-red-100">
                            ❌ Tải lên thất bại
                          </p>
                        </div>
                      )}

                      {/* Nội dung file */}
                      <div className="flex-1 flex items-center justify-center overflow-hidden px-4 py-4">
                        {normalizeKind(selectedFile) === "photo" && (
                          <button
                            type="button"
                            className="relative w-full h-full flex items-center justify-center cursor-pointer bg-transparent border-0 p-0"
                            onClick={(e) => {
                              // click lên nền/ảnh -> đóng
                              if (
                                e.target === e.currentTarget ||
                                (e.target as HTMLElement).tagName === "IMG"
                              ) {
                                onClose();
                              }
                            }}
                            aria-label="Click to close"
                          >
                            <img
                              src={selectedFile.url}
                              alt={selectedFile.name}
                              className="max-w-full max-h-[calc(100vh-12rem)] object-contain rounded-lg shadow-2xl pointer-events-none"
                              style={
                                selectedFile.width && selectedFile.height
                                  ? {
                                      aspectRatio: `${selectedFile.width} / ${selectedFile.height}`,
                                    }
                                  : undefined
                              }
                            />
                          </button>
                        )}

                        {normalizeKind(selectedFile) === "video" && (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <video
                              src={selectedFile.url}
                              controls
                              autoPlay
                              className="max-w-full max-h-[calc(100vh-12rem)] rounded-lg shadow-2xl bg-black"
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
                          </div>
                        )}

                        {normalizeKind(selectedFile) === "audio" && (
                          <div className="w-full max-w-2xl space-y-6">
                            <div className="aspect-square max-w-md mx-auto bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 rounded-2xl flex items-center justify-center shadow-2xl">
                              <MusicalNoteIcon className="w-32 h-32 text-white/90" />
                            </div>
                            <div className="bg-gray-800/70 rounded-xl p-4 backdrop-blur-sm">
                              <audio
                                src={selectedFile.url}
                                controls
                                autoPlay
                                className="w-full"
                              >
                                <track kind="captions" />
                              </audio>
                            </div>
                          </div>
                        )}

                        {normalizeKind(selectedFile) === "pdf" && (
                          <iframe
                            src={selectedFile.url}
                            title={`PDF preview: ${selectedFile.name}`}
                            className="w-full h-full bg-white rounded-md"
                          />
                        )}

                        {normalizeKind(selectedFile) === "file" && (
                          <div className="text-center py-10 px-8">
                            <div className="bg-gradient-to-br from-blue-600 to-cyan-600 w-28 h-28 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                              <DocumentIcon className="w-16 h-16 text-white" />
                            </div>
                            <p className="text-base text-gray-100 mb-1 font-medium">
                              {selectedFile.name}
                            </p>
                            <p className="text-sm text-gray-400 mb-6">
                              Không thể xem trước file này
                            </p>
                            {selectedFile.status === "uploaded" && (
                              <Button
                                color="primary"
                                size="lg"
                                startContent={
                                  <ArrowDownTrayIcon className="w-5 h-5" />
                                }
                                onPress={() => {
                                  const link = document.createElement("a");
                                  link.href =
                                    selectedFile.uploadedUrl ||
                                    selectedFile.url;
                                  link.download = selectedFile.name;
                                  link.click();
                                }}
                                className="bg-gradient-to-r from-blue-600 to-cyan-600 font-semibold"
                              >
                                Tải xuống
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sidebar thumbnails */}
                    {files.length > 1 && (
                      <div className="w-20 sm:w-24 md:w-28 border-l border-white/10 bg-gray-900/80 px-2 py-3">
                        <div className="flex flex-col gap-2 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                          {files.map((file, idx) => {
                            const isActive = idx === currentIndex;
                            const thumbKind = normalizeKind(file);
                            return (
                              <button
                                key={file._id}
                                type="button"
                                onClick={() => {
                                  setCurrentIndex(idx);
                                  setSelectedFile(file);
                                }}
                                className={`
                                  flex-shrink-0 w-full aspect-square rounded-lg overflow-hidden transition-all
                                  ${
                                    isActive
                                      ? "ring-2 ring-blue-500 opacity-100 scale-105"
                                      : "opacity-60 hover:opacity-100 hover:scale-105"
                                  }
                                `}
                              >
                                {thumbKind === "photo" && (
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                    style={
                                      file.width && file.height
                                        ? {
                                            aspectRatio: `${file.width} / ${file.height}`,
                                          }
                                        : undefined
                                    }
                                  />
                                )}
                                {thumbKind === "video" && (
                                  <div className="w-full h-full bg-black flex items-center justify-center">
                                    <PlayCircleIcon className="w-6 h-6 text-white" />
                                  </div>
                                )}
                                {thumbKind === "audio" && (
                                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center">
                                    <MusicalNoteIcon className="w-6 h-6 text-white" />
                                  </div>
                                )}
                                {thumbKind === "pdf" && (
                                  <div className="w-full h-full bg-white flex items-center justify-center">
                                    <DocumentTextIcon className="w-6 h-6 text-red-500" />
                                  </div>
                                )}
                                {thumbKind === "file" && (
                                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <DocumentIcon className="w-6 h-6 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

// Helper: handle both number and MongoDB Long
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
