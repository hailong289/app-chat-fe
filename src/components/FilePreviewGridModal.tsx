"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Button,
} from "@heroui/react";
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@heroicons/react/16/solid";
import { FilePreview } from "@/store/types/message.state";

type Props = {
  readonly files: readonly FilePreview[];
  readonly onRemove?: (index: number) => void;
  readonly onRemoveAll?: () => void; // Hàm xóa tất cả files
  readonly className?: string;
  // bật inline PDF (nếu muốn)
  readonly showPdfInline?: boolean;
};

const fmt = (n: number) => {
  if (n < 1024) {
    return `${n} B`;
  } else if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  } else {
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
};

const isImage = (t: string | undefined) =>
  t && (t.startsWith("image/") || t === "image" || t === "photo");
const isVideo = (t: string | undefined) =>
  t && (t.startsWith("video/") || t === "video");
const isAudio = (t: string | undefined) =>
  t && (t.startsWith("audio/") || t === "audio");
const isPdf = (t: string | undefined) =>
  t && (t === "application/pdf" || t === "pdf");

const getFileType = (file: FilePreview) => file.mimeType || file.kind;

const iconByExt = (ext: string) => {
  if (/^pdf$/i.test(ext)) return "📄";
  if (/^(zip|rar|7z|tar|gz)$/i.test(ext)) return "🗜️";
  if (/^(mp3|wav|ogg)$/i.test(ext)) return "🎵";
  if (/^(mp4|mov|avi|mkv|webm)$/i.test(ext)) return "🎞️";
  if (/^(doc|docx)$/i.test(ext)) return "📝";
  if (/^(xls|xlsx|csv)$/i.test(ext)) return "📊";
  if (/^(ppt|pptx)$/i.test(ext)) return "📈";
  if (/^(txt|json|log)$/i.test(ext)) return "📃";
  return "📁";
};

export default function FilePreviewGridModal({
  files,
  onRemove,
  onRemoveAll,
  className = "",
  showPdfInline = false,
}: Props) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const previewableIdx = useMemo(
    () =>
      files
        .map((f, i) =>
          isImage(f.mimeType) ||
          isVideo(f.mimeType) ||
          isAudio(f.mimeType) ||
          (showPdfInline && isPdf(f.mimeType))
            ? i
            : -1
        )
        .filter((i) => i !== -1),
    [files, showPdfInline]
  );

  const openPreview = (i: number) => {
    const t = files[i]?.mimeType ?? "";
    if (isImage(t) || isVideo(t) || isAudio(t) || (showPdfInline && isPdf(t))) {
      setOpenIndex(i);
      onOpen();
    } else {
      // file khác: mở tab mới / tải về
      const url = files[i]?.url;
      if (url) window.open(url, "_blank");
    }
  };

  const goPrev = () => {
    if (openIndex === null || !previewableIdx.length) return;
    const cur = previewableIdx.indexOf(openIndex);
    const next = (cur - 1 + previewableIdx.length) % previewableIdx.length;
    setOpenIndex(previewableIdx[next]);
  };

  const goNext = () => {
    if (openIndex === null || !previewableIdx.length) return;
    const cur = previewableIdx.indexOf(openIndex);
    const next = (cur + 1) % previewableIdx.length;
    setOpenIndex(previewableIdx[next]);
  };

  // phím tắt: ESC do Modal lo; thêm ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [isOpen, openIndex, previewableIdx]);

  return (
    <>
      {/* Header với nút xóa tất cả */}
      {files.length > 0 && (
        <div className="mb-2 flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </span>
          {onRemoveAll && (
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onClick={onRemoveAll}
            >
              Remove All
            </Button>
          )}
        </div>
      )}

      {/* GRID */}
      <div
        className={`mb-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 ${className} bg-gray-50 `}
      >
        {files.map((item, i) => {
          const ext = item.name.split(".").pop() || "";
          const t = item.mimeType;
          const _isImage = isImage(t);
          const _isVideo = isVideo(t);

          let previewContent;
          if (_isImage) {
            previewContent = (
              <img
                src={item.url}
                alt={item.name}
                className="w-25 h-full object-cover"
              />
            );
          } else if (_isVideo) {
            previewContent = (
              <video
                src={item.url}
                className="w-25 h-full object-cover bg-black"
              >
                <track kind="captions" />
              </video>
            );
          } else {
            previewContent = (
              <div className="flex flex-col items-center justify-center h-24 text-sm px-2 text-center">
                <div className="text-2xl mb-1">{iconByExt(ext)}</div>
                <p className="truncate w-full">{item.name}</p>
                <p className="text-[11px] text-gray-500">{fmt(item.size)}</p>
              </div>
            );
          }

          return (
            <button
              key={`${item.name}-${item.url}`}
              type="button"
              className="h-25 w-25 relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
              title={`${item.name} (${fmt(item.size)})`}
              onClick={() => openPreview(i)}
            >
              {previewContent}

              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </button>
          );
        })}
      </div>

      {/* MODAL PREVIEW */}
      <Modal
        size="full"
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) setOpenIndex(null);
          onOpenChange();
        }}
        scrollBehavior="outside"
        classNames={{
          base: "bg-black/80", // overlay tối hơn
          wrapper: "p-4",
        }}
        hideCloseButton
      >
        <ModalContent>
          {() => {
            const i = openIndex ?? 0;
            const item = files[i];
            const t = item?.mimeType ?? "";
            const name = item?.name ?? "";

            return (
              <>
                <ModalHeader className="flex items-center gap-2 text-white">
                  <span className="truncate">{name}</span>
                </ModalHeader>
                <ModalBody className="flex items-center justify-center bg-black">
                  {item && (
                    <>
                      {isImage(t) && (
                        <img
                          src={item.url}
                          alt={name}
                          className="max-w-[90vw] max-h-[70vh] object-contain"
                        />
                      )}
                      {isVideo(t) && (
                        <video
                          src={item.url}
                          controls
                          autoPlay
                          className="max-w-[90vw] max-h-[70vh] object-contain bg-black"
                        >
                          <track kind="captions" />
                        </video>
                      )}
                      {isAudio(t) && (
                        <div className="w-[80vw] sm:w-[520px] text-white">
                          <audio src={item.url} controls className="w-full">
                            <track kind="captions" />
                          </audio>
                        </div>
                      )}
                      {showPdfInline && isPdf(t) && (
                        <iframe
                          src={item.url}
                          title={`PDF preview: ${name}`}
                          className="w-[90vw] h-[70vh] bg-white rounded-md"
                        />
                      )}
                      {!isImage(t) &&
                        !isVideo(t) &&
                        !isAudio(t) &&
                        !(showPdfInline && isPdf(t)) && (
                          <div className="text-center text-white/90">
                            <p className="mb-4">
                              Định dạng này chưa hỗ trợ xem trước.
                            </p>
                            <a
                              href={item?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block px-4 py-2 bg-white text-black rounded-lg"
                            >
                              Mở tab mới / tải về
                            </a>
                          </div>
                        )}
                    </>
                  )}

                  {/* nút chuyển trái/phải */}
                  {previewableIdx.length > 1 && (
                    <>
                      <button
                        onClick={goPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white"
                        aria-label="Prev"
                      >
                        <ArrowLeftIcon className="w-8 h-8" />
                      </button>
                      <button
                        onClick={goNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/90 hover:text-white"
                        aria-label="Next"
                      >
                        <ArrowRightIcon className="w-8 h-8" />
                      </button>
                    </>
                  )}
                </ModalBody>
                <ModalFooter className="justify-between">
                  <Button
                    variant="light"
                    className="text-white"
                    startContent={<ArrowLeftIcon className="w-4 h-4" />}
                    onPress={goPrev}
                    isDisabled={!previewableIdx.length}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="light"
                    className="text-white"
                    onPress={() => onOpenChange()}
                    startContent={<XMarkIcon className="w-4 h-4" />}
                  >
                    Đóng
                  </Button>
                  <Button
                    variant="light"
                    className="text-white"
                    endContent={<ArrowRightIcon className="w-4 h-4" />}
                    onPress={goNext}
                    isDisabled={!previewableIdx.length}
                  >
                    Sau
                  </Button>
                </ModalFooter>
              </>
            );
          }}
        </ModalContent>
      </Modal>
    </>
  );
}
