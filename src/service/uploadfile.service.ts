import { UploadSingleResp } from "@/types/upload.type";
import apiService from "./api.service";

export type UploadMultipleItem = UploadSingleResp & { index?: number };
export type UploadMultipleResp =
  | { files: UploadMultipleItem[] } // trường hợp backend trả dạng mảng object
  | { urls: string[] } // hoặc chỉ trả mảng url
  | any; // fallback nếu schema khác

export default class UploadService {
  // === BASIC APIs (cùng style với RoomService) ===

  static uploadSingle(file: File | Blob, folder = "avatar") {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", folder);

    // ApiService đã tự set Content-Type + Authorization
    return apiService.post<UploadSingleResp>("/filesystem/upload-single", form);
  }

  static uploadMultiple(files: Array<File | Blob>, folder = "avatar") {
    const form = new FormData();
    files.forEach((f) => form.append("files", f)); // tên field: "files" khớp cURL của bạn
    form.append("folder", folder);

    return apiService.post<UploadMultipleResp>(
      "/filesystem/upload-multiple",
      form
    );
  }

  // === ADVANCED (cần progress / cancel) ===
  // dùng thẳng axios instance để truyền onUploadProgress + signal

  static uploadSingleWithProgress(
    file: File | Blob,
    options?: {
      folder?: string;
      onProgress?: (pct: number) => void;
      signal?: AbortSignal; // dùng AbortController để hủy
      endpoint?: string; // override nếu cần
    }
  ) {
    const form = new FormData();
    form.append("file", file);
    form.append("folder", options?.folder ?? "avatar");

    return apiService.axios.post<UploadSingleResp>(
      options?.endpoint ?? "/filesystem/upload-single",
      form,
      {
        signal: options?.signal,
        onUploadProgress: (e) => {
          if (e.total && options?.onProgress) {
            const pct = Math.round((e.loaded / e.total) * 100);
            options.onProgress(pct);
          }
        },
      }
    );
  }

  /**
   * Upload nhiều file tuần tự (dễ hiển thị progress theo từng file).
   * onItemDone được gọi sau mỗi file.
   */
  static async uploadMultipleSequential(
    files: Array<File | Blob>,
    options?: {
      folder?: string;
      onProgress?: (currentIndex: number, pct: number) => void;
      onItemDone?: (index: number, result: UploadSingleResp) => void;
      signal?: AbortSignal;
    }
  ) {
    const out: UploadSingleResp[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const { data } = await this.uploadSingleWithProgress(f, {
        folder: options?.folder ?? "avatar",
        signal: options?.signal,
        onProgress: (pct) => options?.onProgress?.(i, pct),
      });
      options?.onItemDone?.(i, data);
      out.push(data);
    }
    return out;
  }

  /**
   * Upload nhiều file song song (nhanh hơn, nhưng khó hiển thị progress tổng).
   * Có onEachProgress cho từng index.
   */
  static async uploadMultipleParallel(
    files: Array<File | Blob>,
    options?: {
      folder?: string;
      onEachProgress?: (index: number, pct: number) => void;
      signal?: AbortSignal;
    }
  ) {
    const tasks = files.map((f, idx) =>
      this.uploadSingleWithProgress(f, {
        folder: options?.folder ?? "avatar",
        signal: options?.signal,
        onProgress: (pct) => options?.onEachProgress?.(idx, pct),
      }).then((res) => res.data)
    );
    return Promise.all(tasks);
  }
}
