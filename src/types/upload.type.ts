// Response từ API upload file
export type UploadApiResponse = {
  message: string;
  statusCode: number;
  reasonStatusCode: string;
  metadata: {
    _id: string;
    url: string;
    kind: string; // "image" | "video" | "audio" | "document"
    name: string;
    size?: number | { low: number; high: number; unsigned: boolean }; // MongoDB Long type
    mimeType?: string;
    status?: string; // "uploaded" | "pending" | etc
    createdAt?: string;
    contextId?: string;
    contextType?: string;
  };
};

// Type đã normalize để sử dụng trong app
export type UploadSingleResp = {
  _id: string;
  url: string;
  kind?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  status?: string;
  provider?: string;
  publicId?: string;
  originalName?: string;
  createdAt?: string;
  contextId?: string;
  contextType?: string;
  messageId?: string; // Alias for contextId if contextType is message
};
