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
  Progress,
} from "@heroui/react";
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@heroicons/react/16/solid";
import { FilePreview } from "@/store/types/message.state";
import { openWindowWithTauri } from "@/utils/openWindow";
import { useTranslation } from "react-i18next";

type Props = {
  readonly files: readonly FilePreview[];
  readonly onRemove?: (index: number) => void;
  readonly onRemoveAll?: () => void;
  readonly className?: string;
  readonly showPdfInline?: boolean;
};

/** Format size (bytes -> KB / MB) */
const fmt = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

/** Convert Mongo Long / number -> number */
const getFileSize = (
  size: number | { low: number; high: number; unsigned: boolean }
): number => {
  if (typeof size === "number") return size;
  return size.low + size.high * 0x100000000;
};

const isImage = (t: string | undefined) =>
  !!t && (t.startsWith("image/") || t === "image" || t === "photo");

const isVideo = (t: string | undefined) =>
  !!t && (t.startsWith("video/") || t === "video");

const isAudio = (t: string | undefined) =>
  !!t && (t.startsWith("audio/") || t === "audio");

const isPdf = (t: string | undefined) =>
  !!t && (t === "application/pdf" || t === "pdf");

const getFileType = (file: FilePreview) => file.mimeType || file.kind || "";

/** Icon theo extension, kiểu “low-tech” nhưng dễ đọc */
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
  const { t } = useTranslation();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // danh sách index có thể preview inline
  const previewableIdx = useMemo(
    () =>
      files
        .map((f, i) => {
          const t = getFileType(f);
          return isImage(t) ||
            isVideo(t) ||
            isAudio(t) ||
            (showPdfInline && isPdf(t))
            ? i
            : -1;
        })
        .filter((i) => i !== -1),
    [files, showPdfInline]
  );

  const openPreview = (i: number) => {
    const t = getFileType(files[i]);
    // nếu file đang upload thì không open
    if (files[i].status === "uploading") return;

    if (isImage(t) || isVideo(t) || isAudio(t) || (showPdfInline && isPdf(t))) {
      setOpenIndex(i);
      onOpen();
    } else {
      const url = files[i]?.uploadedUrl || files[i]?.url;
      if (url) void openWindowWithTauri(url, "_blank");
    }
  };

  const goPrev = () => {
    if (openIndex === null || !previewableIdx.length) return;
    const cur = previewableIdx.indexOf(openIndex);
    if (cur === -1) return;
    const next = (cur - 1 + previewableIdx.length) % previewableIdx.length;
    setOpenIndex(previewableIdx[next]);
  };

  const goNext = () => {
    if (openIndex === null || !previewableIdx.length) return;
    const cur = previewableIdx.indexOf(openIndex);
    if (cur === -1) return;
    const next = (cur + 1) % previewableIdx.length;
    setOpenIndex(previewableIdx[next]);
  };

  // phím tắt ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [isOpen, previewableIdx, openIndex]);
  if (files.length === 0) {
    return <></>;
  }
  return (
    <>
      {/* Header nhỏ: tổng số file + nút xoá tất cả */}
      {files.length > 0 && (
        <div className="mb-2 flex justify-between items-center">
          <span className="text-xs sm:text-sm text-default-600">
            {t("chat.file.preview.selected", { count: files.length })}
          </span>
          {onRemoveAll && (
            <Button
              size="sm"
              color="danger"
              variant="flat"
              onPress={onRemoveAll}
            >
              {t("chat.file.preview.removeAll")}
            </Button>
          )}
        </div>
      )}

      {/* GRID PREVIEW */}
      <div
        className={`
          flex flex-wrap gap-2 rounded-xl bg-content2/60 p-2
          border border-default-200
          ${className}
        `}
      >
        {files.map((item, i) => {
          const ext = item.name.split(".").pop() || "";
          const type = getFileType(item);
          const size = fmt(getFileSize(item.size));
          const uploading = item.status === "uploading";
          const failed = item.status === "failed";

          let previewContent: React.ReactNode;

          if (isImage(type)) {
            previewContent = (
              <img
                src={item.url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            );
          } else if (isVideo(type)) {
            previewContent = (
              <video
                src={item.url}
                className="w-full h-full object-cover bg-black"
              >
                <track kind="captions" />
              </video>
            );
          } else {
            previewContent = (
              <div className="flex flex-col items-center justify-center h-full text-[11px] px-1 text-center">
                <div className="text-xl mb-1">{iconByExt(ext)}</div>
                <p className="truncate w-full">{item.name}</p>
                <p className="text-[10px] text-default-500">{size}</p>
              </div>
            );
          }

          return (
            <div
              key={`${item.name}-${item.url}-${i}`}
              className={`
                relative group h-16 w-16 sm:h-20 sm:w-20
                rounded-xl overflow-hidden
                border border-default-200
                bg-content1 cursor-pointer
                focus:outline-none focus:ring-2 focus:ring-primary
              `}
              title={`${item.name} (${size})`}
              onClick={() => openPreview(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPreview(i);
                }
              }}
              role="button"
              tabIndex={0}
            >
              {previewContent}

              {/* Trạng thái uploading */}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center px-2">
                  <Progress
                    size="sm"
                    value={item.uploadProgress || 0}
                    color="primary"
                    className="w-full mb-1"
                  />
                  <p className="text-[10px] text-white text-center">
                    {t("chat.file.preview.uploading")}{" "}
                    {item.uploadProgress || 0}%
                  </p>
                </div>
              )}

              {/* Trạng thái failed */}
              {failed && (
                <div className="absolute inset-0 bg-danger-500/80 flex items-center justify-center">
                  <p className="text-[10px] text-white font-semibold text-center px-1">
                    {t("chat.file.preview.failed")}
                  </p>
                </div>
              )}

              {/* Nút remove */}
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
                  <XMarkIcon className="w-3 h-3" />
                </button>
              )}
            </div>
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
        hideCloseButton
        classNames={{
          base: "bg-black/85",
          wrapper: "p-2 sm:p-4",
        }}
      >
        <ModalContent>
          {() => {
            const i = openIndex ?? 0;
            const item = files[i];
            const type = item ? getFileType(item) : "";
            const name = item?.name ?? "";

            return (
              <>
                <ModalHeader className="flex items-center justify-between gap-2 text-white border-b border-white/10">
                  <span className="truncate text-sm sm:text-base">{name}</span>
                  <Button
                    size="sm"
                    variant="light"
                    className="text-white"
                    startContent={<XMarkIcon className="w-4 h-4" />}
                    onPress={() => onOpenChange()}
                  >
                    {t("chat.file.preview.close")}
                  </Button>
                </ModalHeader>

                <ModalBody className="flex items-center justify-center bg-black relative">
                  {item && (
                    <>
                      {isImage(type) && (
                        <img
                          src={item.url}
                          alt={name}
                          className="max-w-[95vw] max-h-[75vh] object-contain"
                        />
                      )}

                      {isVideo(type) && (
                        <video
                          src={item.url}
                          controls
                          autoPlay
                          className="max-w-[95vw] max-h-[75vh] object-contain bg-black"
                        >
                          <track kind="captions" />
                        </video>
                      )}

                      {isAudio(type) && (
                        <div className="w-[90vw] max-w-lg text-white">
                          <audio src={item.url} controls className="w-full">
                            <track kind="captions" />
                          </audio>
                        </div>
                      )}

                      {showPdfInline && isPdf(type) && (
                        <iframe
                          src={item.url}
                          title={`PDF preview: ${name}`}
                          className="w-[95vw] h-[75vh] bg-white rounded-md"
                        />
                      )}

                      {!isImage(type) &&
                        !isVideo(type) &&
                        !isAudio(type) &&
                        !(showPdfInline && isPdf(type)) && (
                          <div className="text-center text-white/90">
                            <p className="mb-4">
                              {t("chat.file.preview.notSupported")}
                            </p>
                            <a
                              href={item.uploadedUrl || item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-block px-4 py-2 bg-white text-black rounded-lg text-sm font-medium"
                            >
                              {t("chat.file.preview.openNewTab")}
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
                        className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 text-white/90 hover:text-white"
                        aria-label="Prev"
                      >
                        <ArrowLeftIcon className="w-7 h-7 sm:w-8 sm:h-8" />
                      </button>
                      <button
                        onClick={goNext}
                        className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 text-white/90 hover:text-white"
                        aria-label="Next"
                      >
                        <ArrowRightIcon className="w-7 h-7 sm:w-8 sm:h-8" />
                      </button>
                    </>
                  )}
                </ModalBody>

                {/* Footer: điều hướng nhanh */}
                <ModalFooter className="justify-between border-t border-white/10">
                  <Button
                    variant="light"
                    className="text-white"
                    startContent={<ArrowLeftIcon className="w-4 h-4" />}
                    onPress={goPrev}
                    isDisabled={!previewableIdx.length}
                  >
                    {t("chat.file.preview.prev")}
                  </Button>
                  <span className="text-xs text-white/70">
                    {openIndex !== null
                      ? `${previewableIdx.indexOf(openIndex) + 1}/${
                          previewableIdx.length || files.length
                        }`
                      : ""}
                  </span>
                  <Button
                    variant="light"
                    className="text-white"
                    endContent={<ArrowRightIcon className="w-4 h-4" />}
                    onPress={goNext}
                    isDisabled={!previewableIdx.length}
                  >
                    {t("chat.file.preview.next")}
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
