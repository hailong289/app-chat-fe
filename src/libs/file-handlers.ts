// file-handlers.ts
import * as React from "react";
import { ObjectId } from "bson";
import { FilePreview } from "@/store/types/message.state";

/** ===== Types & Defaults ===== */

// Định nghĩa type FilePreview đúng chuẩn

export type FileAcceptConfig = {
  accept: string[]; // ví dụ: ["image/*", "video/*", "application/pdf"]
  maxFiles: number; // số file tối đa
  maxSizeMB: number; // giới hạn size mỗi file (MB)
};

export const defaultConfig: FileAcceptConfig = {
  accept: ["image/*", "video/*", "application/pdf"],
  maxFiles: 10,
  maxSizeMB: 20,
};

/** Build regex từ accept pattern ("image/*" -> /^image\/.*$/i) */
export function buildAcceptRegex(accept: string[]) {
  const parts = accept.map((a) => a.replace("*", ".*").replace("/", "\\/"));
  return new RegExp(`^(${parts.join("|")})$`, "i");
}

/** MIME fallback theo extension (khi file.type rỗng – clipboard/drag có thể gặp) */
export function guessMimeByExt(name: string): string | null {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml",

    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",

    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",

    pdf: "application/pdf",
    txt: "text/plain",
    log: "text/plain",
    json: "application/json",
    csv: "text/csv",

    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
  };
  return map[ext] || null;
}

/** ===== Utilities ===== */

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] || "application/octet-stream";
  const bin =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new File([u8], filename, { type: mime });
}

/** Kiểm tra file có được chấp nhận theo accept list không */
export function isAccepted(file: File, accept: string[], acceptRegex?: RegExp) {
  const regex = acceptRegex ?? buildAcceptRegex(accept);
  if (file.type && regex.test(file.type)) return true;

  // fallback nếu type rỗng: đoán theo tên
  const guessed = guessMimeByExt(file.name);
  if (guessed && regex.test(guessed)) return true;

  // chấp nhận mọi loại nếu có "*/*"
  if (accept.includes("*/*")) return true;

  return false;
}

/** Chuẩn hoá + validate danh sách File */
export function normalizeAndValidateFiles(
  files: File[],
  cfg: FileAcceptConfig
): File[] {
  const out: File[] = [];
  const MAX_SIZE_BYTES = cfg.maxSizeMB * 1024 * 1024;
  const acceptRegex = buildAcceptRegex(cfg.accept);

  for (const f of files) {
    if (!isAccepted(f, cfg.accept, acceptRegex)) continue;
    if (f.size > MAX_SIZE_BYTES) continue;

    out.push(f);
    if (out.length >= cfg.maxFiles) break;
  }
  return out;
}

/** Tạo preview URL cho mỗi file */
export function toPreviews(files: File[]): FilePreview[] {
  return files.map((f) => {
    const url = URL.createObjectURL(f);
    const mimeType =
      f.type || guessMimeByExt(f.name) || "application/octet-stream";
    const kind = mimeType.startsWith("image/")
      ? "photo"
      : mimeType.startsWith("video/")
      ? "video"
      : mimeType.startsWith("audio/")
      ? "audio"
      : "file";

    return {
      _id: new ObjectId().toHexString(),
      kind,
      url,
      name: f.name,
      size: f.size,
      mimeType,
      status: "pending", // Trạng thái ban đầu
    };
  });
}

/** Giải phóng blob URL khi remove/clear */
export function revokePreviews(previews: FilePreview[]) {
  previews.forEach((p) => {
    try {
      URL.revokeObjectURL(p.url);
    } catch {}
  });
}

/** Thêm files mới vào state attachments (FilePreview[]) */
export function addFiles(
  current: FilePreview[],
  incoming: File[],
  cfg: FileAcceptConfig = defaultConfig
): FilePreview[] {
  const valid = normalizeAndValidateFiles(incoming, cfg);
  if (!valid.length) return current;

  const combined = [...current, ...toPreviews(valid)];

  if (combined.length > cfg.maxFiles) {
    // phần thừa
    const overflow = combined.slice(cfg.maxFiles);
    revokePreviews(overflow);
  }
  return combined.slice(0, cfg.maxFiles);
}

/** Xoá 1 item khỏi attachments */
export function removeAttachmentAt(
  list: FilePreview[],
  index: number
): FilePreview[] {
  const copy = [...list];
  const [removed] = copy.splice(index, 1);
  if (removed) {
    try {
      URL.revokeObjectURL(removed.url);
    } catch {}
  }
  return copy;
}

/** Cleanup tất cả previews – dùng trong useEffect return */
export function cleanupAll(previewsRef: React.MutableRefObject<FilePreview[]>) {
  return () => revokePreviews(previewsRef.current);
}

/** ===== Factories cho Handlers (React) ===== */

/** onPaste cho div/input */
export function handlePasteFactory(
  setAttachments: (updater: (prev: FilePreview[]) => FilePreview[]) => void,
  cfg: FileAcceptConfig = defaultConfig
) {
  return (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items?.length) return;

    const files: File[] = [];
    for (const it of items as any) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }

    // Một số app paste image dưới dạng dataURL text
    if (!files.length) {
      const textData = e.clipboardData?.getData("text/plain");
      if (textData && /^data:image\/\w+;base64,/.test(textData)) {
        files.push(dataUrlToFile(textData, `pasted-${Date.now()}.png`));
      }
    }

    if (!files.length) return;

    e.preventDefault(); // chặn chèn binary vào input
    setAttachments((prev) => addFiles(prev, files, cfg));
  };
}

/** onChange của <input type="file" multiple> */
export function handleFilePickFactory(
  setAttachments: (updater: (prev: FilePreview[]) => FilePreview[]) => void,
  cfg: FileAcceptConfig = defaultConfig
) {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length) {
      setAttachments((prev) => addFiles(prev, list, cfg));
    }
    // reset để chọn lại cùng file vẫn trigger
    e.currentTarget.value = "";
  };
}

/** onDragOver của container (bắt buộc preventDefault để drop hoạt động) */
export function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
}

/** onDragLeave – tránh nhấp nháy khi rời element con */
export function handleDragLeaveFactory(setIsDragging?: (v: boolean) => void) {
  return (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) {
      setIsDragging?.(false);
    }
  };
}

/** onDrop của container */
export function handleDropFactory(
  setAttachments: (updater: (prev: FilePreview[]) => FilePreview[]) => void,
  cfg: FileAcceptConfig = defaultConfig,
  setIsDragging?: (v: boolean) => void
) {
  return (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging?.(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length) setAttachments((prev) => addFiles(prev, files, cfg));
  };
}
