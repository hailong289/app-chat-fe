import React, { useEffect, useCallback } from "react";
import { Modal, ModalContent, ModalBody, Button, Image } from "@heroui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { openWindowWithTauri } from "@/utils/openWindow";

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: any[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
}

export default function MediaViewerModal({
  isOpen,
  onClose,
  files,
  currentIndex,
  setCurrentIndex,
}: MediaViewerModalProps) {
  const currentFile = files[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < files.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, files.length, setCurrentIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex, setCurrentIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "Escape") onClose();
    },
    [isOpen, handleNext, handlePrev, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!currentFile) return null;

  const isImage =
    currentFile.mimeType?.startsWith("image") ||
    currentFile.kind === "image" ||
    currentFile.kind === "photo";
  const isVideo =
    currentFile.mimeType?.startsWith("video") || currentFile.kind === "video";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      classNames={{
        base: "bg-black/90 text-white",
        closeButton: "hover:bg-white/10 active:bg-white/20 text-white",
      }}
      backdrop="blur"
    >
      <ModalContent>
        {(onClose) => (
          <ModalBody className="p-0 relative flex items-center justify-center h-full w-full overflow-hidden">
            {/* Close Button Custom */}
            <Button
              isIconOnly
              variant="light"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onPress={onClose}
            >
              <XMarkIcon className="w-6 h-6" />
            </Button>

            {/* Download Button */}
            <Button
              isIconOnly
              variant="light"
              className="absolute top-4 right-16 z-50 text-white hover:bg-white/20"
              onPress={() => void openWindowWithTauri(currentFile.url, "_blank")}
            >
              <ArrowDownTrayIcon className="w-6 h-6" />
            </Button>

            {/* Navigation Buttons */}
            {currentIndex > 0 && (
              <Button
                isIconOnly
                variant="light"
                className="absolute left-4 z-50 text-white hover:bg-white/20 hidden sm:flex"
                onPress={handlePrev}
              >
                <ChevronLeftIcon className="w-8 h-8" />
              </Button>
            )}

            {currentIndex < files.length - 1 && (
              <Button
                isIconOnly
                variant="light"
                className="absolute right-4 z-50 text-white hover:bg-white/20 hidden sm:flex"
                onPress={handleNext}
              >
                <ChevronRightIcon className="w-8 h-8" />
              </Button>
            )}

            {/* Content */}
            <div className="w-full h-full flex items-center justify-center p-4 sm:p-12">
              {isImage ? (
                <img
                  src={currentFile.url}
                  alt={currentFile.name}
                  className="max-w-full max-h-full object-contain"
                />
              ) : isVideo ? (
                <video
                  src={currentFile.url}
                  controls
                  className="max-w-full max-h-full"
                  autoPlay
                />
              ) : (
                <div className="text-center">
                  <p className="text-xl mb-4">Cannot preview this file type</p>
                  <Button
                    color="primary"
                    onPress={() => void openWindowWithTauri(currentFile.url, "_blank")}
                  >
                    Download to view
                  </Button>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-center">
              <p className="font-medium truncate px-8">
                {currentFile.name || "Untitled"}
              </p>
              <p className="text-sm text-gray-400">
                {currentIndex + 1} / {files.length}
              </p>
            </div>
          </ModalBody>
        )}
      </ModalContent>
    </Modal>
  );
}
