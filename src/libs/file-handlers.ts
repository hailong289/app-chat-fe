// file-handlers.ts
import * as React from "react";
import { ObjectId } from "bson";
import { FilePreview } from "@/store/types/message.state";
import imageCompression from "browser-image-compression";

/** ===== Types & Defaults ===== */

// Định nghĩa type FilePreview đúng chuẩn

export type FileAcceptConfig = {
  accept: string[]; // ví dụ: ["image/*", "video/*", "application/pdf"]
  maxFiles: number; // số file tối đa
  maxSizeMB: number; // giới hạn size mỗi file (MB)
  compressImages?: boolean; // Tự động nén ảnh
  compressQuality?: number; // Chất lượng nén (0-1)
};

export const defaultConfig: FileAcceptConfig = {
  accept: ["image/*", "video/*", "application/pdf"],
  maxFiles: 10,
  maxSizeMB: 50, // Tăng lên 50MB để hỗ trợ video files lớn hơn
  compressImages: false, // Mặc định không nén, để user chọn
  compressQuality: 0.8, // Chất lượng nén 80%
};
export const documentOnlyConfig: FileAcceptConfig = {
  accept: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

    "text/plain",
    "text/csv",
    "application/json",
  ],
  maxFiles: 10,
  maxSizeMB: 50,
  compressImages: false, // tài liệu thì khỏi nén
  compressQuality: 0.8,
};
/** Build regex từ accept pattern ("image/*" -> /^image\/.*$/i) */
export function buildAcceptRegex(accept: string[]) {
  const parts = accept.map((a) => a.replace("*", ".*").replace("/", "\\/"));
  return new RegExp(`^(${parts.join("|")})$`, "i");
}
export function buildInputAccept(accept: string[]): string {
  return accept.join(",");
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

/**
 * Nén ảnh sử dụng browser-image-compression
 * @param file File ảnh cần nén
 * @param quality Chất lượng nén (0-1), mặc định 0.8
 * @returns File đã nén hoặc file gốc nếu không thể nén
 */
export async function compressImage(
  file: File,
  quality: number = 0.8
): Promise<File> {
  // Chỉ nén nếu là ảnh
  if (!file.type.startsWith("image/")) {
    console.log("⏭️ Skipping compression (not an image):", file.name);
    return file;
  }

  // Không nén GIF và SVG
  if (file.type === "image/gif" || file.type === "image/svg+xml") {
    console.log("⏭️ Skipping compression (GIF/SVG):", file.name);
    return file;
  }

  try {
    const originalSize = file.size / 1024 / 1024; // MB
    console.log(
      `🗜️ Compressing image: ${file.name} (${originalSize.toFixed(2)}MB)`
    );

    const options = {
      maxSizeMB: 10, // Nén tối đa xuống 10MB
      maxWidthOrHeight: 1920, // Resize xuống max 1920px
      useWebWorker: true,
      initialQuality: quality,
    };

    const compressedFile = await imageCompression(file, options);
    const compressedSize = compressedFile.size / 1024 / 1024; // MB

    console.log(
      `✅ Compressed: ${file.name} | ${originalSize.toFixed(
        2
      )}MB → ${compressedSize.toFixed(2)}MB (${(
        (1 - compressedSize / originalSize) *
        100
      ).toFixed(1)}% reduction)`
    );

    return compressedFile;
  } catch (error) {
    console.error("❌ Compression failed:", error);
    return file; // Trả về file gốc nếu lỗi
  }
}

/**
 * Nén nhiều files
 * @param files Mảng files cần nén
 * @param quality Chất lượng nén
 * @param onProgress Callback để track tiến trình
 */
export async function compressFiles(
  files: File[],
  quality: number = 0.8,
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const compressed: File[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.(i + 1, files.length);

    const result = await compressImage(file, quality);
    compressed.push(result);
  }

  return compressed;
}

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
  // sanitize filename to avoid upload issues with special chars
  const safeName = sanitizeFilename(filename || `file-${Date.now()}`);
  return new File([u8], safeName, { type: mime });
}

/**
 * Sanitize a filename by removing/normalizing special characters and diacritics.
 * - keeps ascii letters, numbers, dot, dash and underscore
 * - replaces other characters with the replacement (default `_`)
 * - trims and collapses repeated replacement chars
 * - limits the total basename length to maxLength
 */
export function sanitizeFilename(
  name: string,
  options: { replacement?: string; maxLength?: number } = {}
) {
  const replacement = options.replacement ?? "_";
  const maxLength = options.maxLength ?? 80;

  if (!name) return `file${replacement}${Date.now()}`;

  // split extension
  const parts = name.split(".");
  const ext = parts.length > 1 ? `.${parts.pop()}` : "";
  const base = parts.join(".") || "file";

  // normalize unicode to NFKD and remove diacritics
  const normalized = base.normalize("NFKD").replace(/\p{Diacritic}/gu, "");

  // replace invalid chars with replacement
  let safe = normalized.replace(/[^A-Za-z0-9._-]+/g, replacement);

  // collapse multiple replacements
  const repEsc = replacement.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  safe = safe.replace(new RegExp(`${repEsc}{2,}`, "g"), replacement);

  // trim replacements from ends
  safe = safe.replace(new RegExp(`^(?:${repEsc})+|(?:${repEsc})+$`, "g"), "");

  // truncate if too long
  if (safe.length > maxLength) safe = safe.slice(0, maxLength);

  // fallback
  if (!safe) safe = `file${replacement}${Date.now()}`;

  return `${safe}${ext}`;
}

/** Kiểm tra file có được chấp nhận theo accept list không */
export function isAccepted(file: File, accept: string[], acceptRegex?: RegExp) {
  const regex = acceptRegex ?? buildAcceptRegex(accept);

  // Log để debug
  console.log("🔍 Checking file:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (file.type && regex.test(file.type)) {
    console.log("✅ Accepted by file.type:", file.type);
    return true;
  }

  // fallback nếu type rỗng: đoán theo tên
  const guessed = guessMimeByExt(file.name);
  console.log("🔍 Guessed MIME:", guessed);

  if (guessed && regex.test(guessed)) {
    console.log("✅ Accepted by guessed MIME:", guessed);
    return true;
  }

  // chấp nhận mọi loại nếu có "*/*"
  if (accept.includes("*/*")) {
    console.log("✅ Accepted by */*");
    return true;
  }

  console.log("❌ File rejected");
  return false;
}

/** Chuẩn hoá + validate danh sách File (bất đồng bộ để hỗ trợ nén) */
export async function normalizeAndValidateFiles(
  files: File[],
  cfg: FileAcceptConfig
): Promise<File[]> {
  const out: File[] = [];
  const MAX_SIZE_BYTES = cfg.maxSizeMB * 1024 * 1024;
  const acceptRegex = buildAcceptRegex(cfg.accept);

  for (const f of files) {
    if (!isAccepted(f, cfg.accept, acceptRegex)) {
      console.log("❌ File not accepted:", f.name);
      continue;
    }

    // Nén ảnh nếu được bật
    let processedFile = f;
    if (cfg.compressImages && f.type.startsWith("image/")) {
      processedFile = await compressImage(f, cfg.compressQuality || 0.8);
    }

    // Kiểm tra lại size sau khi nén
    if (processedFile.size > MAX_SIZE_BYTES) {
      console.log(
        "❌ File too large:",
        processedFile.name,
        `(${(processedFile.size / 1024 / 1024).toFixed(1)}MB > ${
          cfg.maxSizeMB
        }MB)`
      );
      continue;
    }

    out.push(processedFile);
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

    // Tạo tên file mới dựa trên tên gốc nhưng đã được sanitize, kèm timestamp để tránh trùng
    const fileExtension = f.name.split(".").pop() || "";
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extensionPart = fileExtension ? `.${fileExtension}` : "";

    const baseName = f.name.replace(new RegExp(`${extensionPart}$`), "");
    const safeBase = sanitizeFilename(baseName, { maxLength: 48 });
    const newFileName = `${safeBase}_${timestamp}_${randomStr}${extensionPart}`;

    // 🔥 Tạo lại File object với tên mới (sanitized)
    const renamedFile = new File([f], newFileName, {
      type: f.type || mimeType,
      lastModified: f.lastModified,
    });

    return {
      _id: new ObjectId().toHexString(),
      kind,
      url, // Local blob URL
      name: newFileName, // Tên mới
      size: f.size,
      mimeType,
      status: "pending", // Trạng thái ban đầu
      uploadProgress: 0,
      file: renamedFile, // 🔥 Lưu File với tên mới
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
export async function addFiles(
  current: FilePreview[],
  incoming: File[],
  cfg: FileAcceptConfig = defaultConfig,
  onMaxFilesExceeded?: (current: number, max: number) => void
): Promise<FilePreview[]> {
  const valid = await normalizeAndValidateFiles(incoming, cfg);
  if (!valid.length) return current;

  const combined = [...current, ...toPreviews(valid)];

  if (combined.length > cfg.maxFiles) {
    // Gọi callback để thông báo vượt quá giới hạn
    console.log("vượt quá số lượng");
    if (onMaxFilesExceeded) {
      onMaxFilesExceeded(combined.length, cfg.maxFiles);
    }

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
  setAttachments: (
    updater: (prev: FilePreview[]) => FilePreview[] | Promise<FilePreview[]>
  ) => void,
  cfg: FileAcceptConfig = defaultConfig,
  onMaxFilesExceeded?: (current: number, max: number) => void
) {
  return async (e: React.ClipboardEvent) => {
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
    setAttachments(
      async (prev) => await addFiles(prev, files, cfg, onMaxFilesExceeded)
    );
  };
}

/** onChange của <input type="file" multiple> */
export function handleFilePickFactory(
  setAttachments: (
    updater: (prev: FilePreview[]) => FilePreview[] | Promise<FilePreview[]>
  ) => void,
  cfg: FileAcceptConfig = defaultConfig,
  onMaxFilesExceeded?: (current: number, max: number) => void
) {
  return async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (list.length) {
      setAttachments(
        async (prev) => await addFiles(prev, list, cfg, onMaxFilesExceeded)
      );
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
  setAttachments: (
    updater: (prev: FilePreview[]) => FilePreview[] | Promise<FilePreview[]>
  ) => void,
  cfg: FileAcceptConfig = defaultConfig,
  setIsDragging?: (v: boolean) => void,
  onMaxFilesExceeded?: (current: number, max: number) => void
) {
  return async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging?.(false);
    const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
    if (files.length)
      setAttachments(
        async (prev) => await addFiles(prev, files, cfg, onMaxFilesExceeded)
      );
  };
}
