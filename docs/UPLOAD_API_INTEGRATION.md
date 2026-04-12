# Upload API Integration

## API Response Structure

Backend API trả về response theo format:

```typescript
{
  "message": "Tải file thành công",
  "statusCode": 200,
  "reasonStatusCode": "OK",
  "metadata": {
    "_id": "690b0da8ebb69e59282a28f1",
    "url": "https://s3.us-east-005.backblazeb2.com/app-chat-public/019a258a9540000000ff11.019a258c095c000000eb3d/geminigeneratedimageo1cf3yo1cf3yo1cf_1762334453476.png",
    "kind": "image",
    "name": "Gemini_Generated_Image_o1cf3yo1cf3yo1cf.png"
  }
}
```

## Type Definitions

### UploadApiResponse

```typescript
export type UploadApiResponse = {
  message: string;
  statusCode: number;
  reasonStatusCode: string;
  metadata: {
    _id: string; // ID của file trên server
    url: string; // URL public để truy cập file
    kind: string; // Loại file: "image" | "video" | "audio" | "document"
    name: string; // Tên file gốc
  };
};
```

### UploadSingleResp (Normalized)

```typescript
export type UploadSingleResp = {
  _id: string; // ID từ server
  url: string; // URL public
  kind?: string; // Loại file
  name?: string; // Tên file
  provider?: string;
  publicId?: string;
  originalName?: string;
  mime?: string;
  size?: number;
};
```

## Upload Flow

### 1. Client Upload File

```typescript
// Trong useMessageStore.ts
// filesToUpload đã có _id được generate khi user chọn file
const uploadedResults = await UploadService.uploadMultipleParallel(
  filesToUpload.map((att) => att.file!),
  {
    roomId: "room-123",
    id: filesToUpload.map((att) => att._id), // Sử dụng _id có sẵn
    onEachProgress: (index, progress) => {
      console.log(`File ${index}: ${progress}%`);
    },
  }
);
```

### 2. API Call

```typescript
// Trong uploadfile.service.ts
const form = new FormData();
form.append("file", file);
form.append("roomId", options?.roomId ?? "avatar");
form.append("id", options?.id ?? "");

const response = await apiService.axios.post<UploadApiResponse>(
  "/filesystem/upload-single-user",
  form,
  {
    onUploadProgress: (e) => {
      const pct = Math.round((e.loaded / e.total) * 100);
      options?.onProgress?.(pct);
    },
  }
);
```

### 3. Transform Response

```typescript
private static transformUploadResponse(apiResp: UploadApiResponse): UploadSingleResp {
  return {
    _id: apiResp.metadata._id,
    url: apiResp.metadata.url,
    kind: apiResp.metadata.kind,
    name: apiResp.metadata.name,
  };
}
```

### 4. Update FilePreview

```typescript
const updatedAttachments = attachments.map((att) => {
  const uploadResult = uploadedResults[uploadIndex];

  return {
    ...att,
    // _id giữ nguyên (đã dùng att._id khi upload)
    url: uploadResult.url, // Cập nhật URL thật từ server
    uploadedUrl: uploadResult.url,
    kind: uploadResult.kind || att.kind,
    name: uploadResult.name || att.name,
    status: "uploaded",
    uploadProgress: 100,
    file: undefined, // Xóa file gốc
  } as FilePreview;
});
    uploadProgress: 100,
    file: undefined, // Xóa file gốc
  } as FilePreview;
});
```

### 5. Emit Socket với Server IDs

```typescript
socket?.emit("message:send", {
  roomId,
  type,
  content,
  replyTo,
  id: messageId,
  attachments: uploadedAttachments.map((att) => att._id), // Gửi mảng IDs từ server
});
```

## Upload Parameters

### Single Upload

```typescript
POST /filesystem/upload-single-user

FormData:
- file: File | Blob
- roomId: string      // ID của room (để phân loại file)
- id: string          // ID unique cho file này
```

### Multiple Upload (Parallel)

Mỗi file có ID riêng từ FilePreview:

```typescript
// FilePreview đã có _id được generate khi chọn file
const filesToUpload = attachments.filter((att) => att.file);

UploadService.uploadMultipleParallel(
  filesToUpload.map((att) => att.file!),
  {
    roomId: "room-123",
    id: filesToUpload.map((att) => att._id), // Sử dụng _id có sẵn của FilePreview
  }
);
```

**Flow:**

1. User chọn files → Generate FilePreview với `_id = new ObjectId().toHexString()`
2. Upload với `id: filesToUpload.map(att => att._id)` → Backend lưu với \_id này
3. Backend trả về `metadata._id` khớp với ID đã gửi
4. Client update FilePreview với URL từ server, giữ nguyên `_id`

## Response Handling

### Success Response

```json
{
  "message": "Tải file thành công",
  "statusCode": 200,
  "reasonStatusCode": "OK",
  "metadata": {
    "_id": "690b0da8ebb69e59282a28f1",
    "url": "https://s3.backblaze.com/bucket/file.png",
    "kind": "image",
    "name": "file.png"
  }
}
```

### Error Response

```json
{
  "message": "File quá lớn",
  "statusCode": 400,
  "reasonStatusCode": "Bad Request",
  "metadata": null
}
```

## File Kind Mapping

| MIME Type Prefix | Kind Value |
| ---------------- | ---------- |
| `image/*`        | `image`    |
| `video/*`        | `video`    |
| `audio/*`        | `audio`    |
| Others           | `document` |

## Example Usage

### Upload Single Image

```typescript
const { data } = await UploadService.uploadSingleWithProgress(imageFile, {
  roomId: "room-123",
  id: new ObjectId().toHexString(),
  onProgress: (pct) => console.log(`${pct}%`),
});

console.log(data);
// {
//   _id: "690b0da8ebb69e59282a28f1",
//   url: "https://...",
//   kind: "image",
//   name: "photo.jpg"
// }
```

### Upload Multiple Files

```typescript
const files = [imageFile, videoFile, pdfFile];

const results = await UploadService.uploadMultipleParallel(files, {
  roomId: "room-123",
  id: files.map(() => new ObjectId().toHexString()),
  onEachProgress: (index, pct) => {
    console.log(`File ${index}: ${pct}%`);
  },
});

results.forEach((result, i) => {
  console.log(`File ${i}: ID=${result._id}, URL=${result.url}`);
});
```

## Testing

### Test Upload Flow

1. **Select Files**: Chọn ảnh, video, file
2. **Compress** (nếu bật): File được nén trước khi upload
3. **Upload với Progress**: Theo dõi % upload cho mỗi file
4. **Receive Server IDs**: Nhận `_id` và `url` từ server
5. **Update UI**: Hiển thị file với URL thật
6. **Send Message**: Emit socket với `attachments: [id1, id2, id3]`

### Test Checklist

- [ ] Upload 1 ảnh → Nhận đúng `_id` và `url`
- [ ] Upload nhiều file cùng lúc → Mỗi file có ID riêng
- [ ] Progress tracking hiển thị chính xác
- [ ] Sau upload, blob URL được revoke
- [ ] Message emit với mảng server IDs
- [ ] Gallery hiển thị URL thật từ server
- [ ] Refresh page → File vẫn hiển thị đúng

## Troubleshooting

### File không upload

```typescript
// Check logs
console.log("🚀 Starting upload for", attachments.length, "files");
console.log("📤 Upload progress [0]:", 50, "%", filename);
console.log("✅ All files uploaded:", uploadedResults);
```

### Server trả sai format

Kiểm tra `transformUploadResponse()` có nhận đúng cấu trúc API không:

```typescript
private static transformUploadResponse(apiResp: UploadApiResponse): UploadSingleResp {
  console.log("Raw API response:", apiResp);

  return {
    _id: apiResp.metadata._id,
    url: apiResp.metadata.url,
    kind: apiResp.metadata.kind,
    name: apiResp.metadata.name,
  };
}
```

### Missing \_id trong message

Đảm bảo `uploadedAttachments.map((att) => att._id)` được gửi trong socket event:

```typescript
socket?.emit("message:send", {
  attachments: uploadedAttachments.map((att) => att._id), // ← Phải có
});
```
