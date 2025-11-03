export type UploadSingleResp = {
  url: string;
  provider?: string;
  publicId?: string;
  originalName?: string;
  mime?: string;
  size?: number;
  // ... nếu backend trả thêm thì bổ sung vào đây
};
