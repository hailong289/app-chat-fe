# Upload Flow với File ID Tracking

## Tổng quan

Khi user chọn files, mỗi file được tạo một `FilePreview` với `_id` unique. ID này được giữ nguyên xuyên suốt quá trình upload và lưu vào database.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER CHỌN FILES                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. CREATE FilePreview[]                                             │
│                                                                      │
│   File 1 → {                                                        │
│     _id: "690b0da8ebb69e59282a28f1"  ← ObjectId().toHexString()    │
│     file: File,                                                     │
│     url: "blob:http://...",           ← Blob URL tạm                │
│     name: "image.png",                                              │
│     kind: "image",                                                  │
│     status: "pending"                                               │
│   }                                                                 │
│                                                                      │
│   File 2 → {                                                        │
│     _id: "690b0da8ebb69e59282a28f2"  ← ID khác                     │
│     file: File,                                                     │
│     url: "blob:http://...",                                         │
│     ...                                                             │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. SEND MESSAGE (sendMessage)                                       │
│                                                                      │
│   const messageId = new ObjectId().toHexString();                   │
│                                                                      │
│   MessageType = {                                                   │
│     id: messageId,                                                  │
│     attachments: FilePreview[],  ← Chứa files với blob URLs        │
│     status: "uploading"                                             │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. UPLOAD FILES (uploadAttachments)                                 │
│                                                                      │
│   UploadService.uploadMultipleParallel(                             │
│     files: [file1, file2],                                          │
│     {                                                               │
│       roomId: "019a258c095c000000eb3d",                            │
│       id: ["690b0da8ebb69e59282a28f1",  ← Sử dụng _id có sẵn       │
│             "690b0da8ebb69e59282a28f2"]                            │
│     }                                                               │
│   )                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. PARALLEL API CALLS                                               │
│                                                                      │
│   Request 1:                                                        │
│   POST /filesystem/upload-single-user                               │
│   FormData {                                                        │
│     file: File1,                                                    │
│     roomId: "019a258c095c000000eb3d",                              │
│     id: "690b0da8ebb69e59282a28f1"    ← ID của File 1              │
│   }                                                                 │
│   Progress: 0% → 50% → 100%                                         │
│                                                                      │
│   Request 2:                                                        │
│   POST /filesystem/upload-single-user                               │
│   FormData {                                                        │
│     file: File2,                                                    │
│     roomId: "019a258c095c000000eb3d",                              │
│     id: "690b0da8ebb69e59282a28f2"    ← ID của File 2              │
│   }                                                                 │
│   Progress: 0% → 50% → 100%                                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. API RESPONSES                                                    │
│                                                                      │
│   Response 1:                                                       │
│   {                                                                 │
│     message: "Tải file thành công",                                 │
│     statusCode: 200,                                                │
│     metadata: {                                                     │
│       _id: "690b0da8ebb69e59282a28f1",  ← Khớp với ID đã gửi       │
│       url: "https://s3.../image.png",    ← URL thật từ S3          │
│       kind: "image",                                                │
│       name: "image.png"                                             │
│     }                                                               │
│   }                                                                 │
│                                                                      │
│   Response 2:                                                       │
│   {                                                                 │
│     metadata: {                                                     │
│       _id: "690b0da8ebb69e59282a28f2",  ← Khớp với ID đã gửi       │
│       url: "https://s3.../video.mp4",                              │
│       kind: "video",                                                │
│       name: "video.mp4"                                             │
│     }                                                               │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. TRANSFORM RESPONSES                                              │
│                                                                      │
│   transformUploadResponse() → UploadSingleResp[]                    │
│                                                                      │
│   [                                                                 │
│     {                                                               │
│       _id: "690b0da8ebb69e59282a28f1",                             │
│       url: "https://s3.../image.png",                              │
│       kind: "image",                                                │
│       name: "image.png"                                             │
│     },                                                              │
│     {                                                               │
│       _id: "690b0da8ebb69e59282a28f2",                             │
│       url: "https://s3.../video.mp4",                              │
│       kind: "video",                                                │
│       name: "video.mp4"                                             │
│     }                                                               │
│   ]                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. UPDATE FilePreview[]                                             │
│                                                                      │
│   File 1: {                                                         │
│     _id: "690b0da8ebb69e59282a28f1",  ← Giữ nguyên                 │
│     url: "https://s3.../image.png",    ← Thay blob URL = real URL  │
│     uploadedUrl: "https://s3.../image.png",                        │
│     kind: "image",                                                  │
│     name: "image.png",                                              │
│     status: "uploaded",                ← Cập nhật status            │
│     uploadProgress: 100,                                            │
│     file: undefined                    ← Xóa File gốc              │
│   }                                                                 │
│                                                                      │
│   File 2: {                                                         │
│     _id: "690b0da8ebb69e59282a28f2",  ← Giữ nguyên                 │
│     url: "https://s3.../video.mp4",                                │
│     status: "uploaded",                                             │
│     ...                                                             │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 9. UPDATE MESSAGE                                                   │
│                                                                      │
│   MessageType = {                                                   │
│     id: messageId,                                                  │
│     attachments: [                                                  │
│       { _id: "690b...", url: "https://s3.../image.png", ... },    │
│       { _id: "690b...", url: "https://s3.../video.mp4", ... }     │
│     ],                                                              │
│     status: "uploaded"              ← Cập nhật status              │
│   }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 10. EMIT SOCKET                                                     │
│                                                                      │
│   socket.emit("message:send", {                                     │
│     roomId,                                                         │
│     id: messageId,                                                  │
│     content,                                                        │
│     attachments: [                                                  │
│       "690b0da8ebb69e59282a28f1",  ← Gửi mảng IDs                  │
│       "690b0da8ebb69e59282a28f2"                                   │
│     ]                                                               │
│   })                                                                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 11. SERVER SIDE                                                     │
│                                                                      │
│   - Nhận message với attachments: ["690b...", "690b..."]          │
│   - Tìm files trong database theo _id                              │
│   - Liên kết files với message                                     │
│   - Broadcast message đến các clients khác                         │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Points

### 1. ID Generation

- `_id` được tạo khi user chọn file: `new ObjectId().toHexString()`
- ID này được giữ nguyên xuyên suốt flow
- Backend lưu file với chính `_id` này

### 2. URL Lifecycle

```
blob:http://localhost/...  →  https://s3.backblaze.../...
     (Tạm thời)                      (Vĩnh viễn)
```

### 3. Status Flow

```
pending → uploading → uploaded
                   ↓
                 failed
```

### 4. Progress Tracking

```typescript
// Mỗi file có progress riêng
onEachProgress: (index, progress) => {
  updateAttachmentProgress(
    roomId,
    messageId,
    filesToUpload[index]._id, // Track bằng _id
    progress,
    "uploading"
  );
};
```

## Database Consistency

### Client State (messagesRoom)

```typescript
{
  "room-123": {
    messages: [
      {
        id: "msg-1",
        attachments: [
          {
            _id: "690b0da8ebb69e59282a28f1",
            url: "https://s3.../file.png",
            status: "uploaded"
          }
        ]
      }
    ]
  }
}
```

### Server Database

```json
{
  "_id": "690b0da8ebb69e59282a28f1",
  "url": "https://s3.backblaze.com/.../file.png",
  "kind": "image",
  "name": "file.png",
  "roomId": "019a258c095c000000eb3d",
  "uploadedBy": "usr_...",
  "createdAt": "2025-11-05T..."
}
```

**Cả client và server đều reference cùng `_id` → Consistency đảm bảo**

## Example cURL Request

```bash
curl --location 'http://localhost:5000/api/filesystem/upload-single-user' \
  --header 'Authorization: Bearer eyJ...' \
  --form 'file=@"/path/to/image.png"' \
  --form 'roomId="019a258c095c000000eb3d"' \
  --form 'id="690b0da8ebb69e59282a28f1"'
```

**Response:**

```json
{
  "message": "Tải file thành công",
  "statusCode": 200,
  "reasonStatusCode": "OK",
  "metadata": {
    "_id": "690b0da8ebb69e59282a28f1",
    "url": "https://s3.us-east-005.backblazeb2.com/app-chat-public/019a258a9540000000ff11.019a258c095c000000eb3d/image_1762334453476.png",
    "kind": "image",
    "name": "image.png"
  }
}
```

## Verification Checklist

- [ ] FilePreview.\_id được generate khi chọn file
- [ ] Upload request gửi `id: att._id`
- [ ] Server response có `metadata._id` khớp với ID đã gửi
- [ ] Client update FilePreview giữ nguyên `_id`, chỉ update `url`
- [ ] Socket emit gửi mảng `attachments: [_id1, _id2, ...]`
- [ ] Database có records với `_id` khớp
- [ ] Gallery hiển thị files với URL thật từ S3
