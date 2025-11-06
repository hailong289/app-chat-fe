# Upload Debug Guide

## Cách kiểm tra Upload Flow đúng không

### 1. Mở Console và theo dõi logs

Khi upload file, bạn sẽ thấy logs theo thứ tự:

```
🚀 Starting upload for 2 files
📋 File IDs to upload: [
  { name: "image.png", _id: "690b0da8ebb69e59282a28f1" },
  { name: "video.mp4", _id: "690b0da8ebb69e59282a28f2" }
]
📤 Upload progress [0]: 0 % image.png
📤 Upload progress [1]: 0 % video.mp4
📤 Upload progress [0]: 50 % image.png
📤 Upload progress [1]: 45 % video.mp4
📤 Upload progress [0]: 100 % image.png
📤 Upload progress [1]: 100 % video.mp4
✅ All files uploaded: [...]
🔍 Verifying IDs match:
  File 0: ✅ 690b0da8ebb69e59282a28f1 === 690b0da8ebb69e59282a28f1
  File 1: ✅ 690b0da8ebb69e59282a28f2 === 690b0da8ebb69e59282a28f2
```

### 2. Kiểm tra Network Tab

**Request đến `/filesystem/upload-single-user`:**

```
POST /api/filesystem/upload-single-user

FormData:
- file: (binary)
- roomId: "019a258c095c000000eb3d"
- id: "690b0da8ebb69e59282a28f1"  ← ID này phải khớp với FilePreview._id
```

**Response từ server:**

```json
{
  "message": "Tải file thành công",
  "statusCode": 200,
  "reasonStatusCode": "OK",
  "metadata": {
    "_id": "690b0da8ebb69e59282a28f1",  ← Phải khớp với ID đã gửi
    "url": "https://s3.../file.png",
    "kind": "image",
    "name": "image.png"
  }
}
```

### 3. Kiểm tra Database

Query database để verify:

```javascript
// Trong MongoDB/Database
db.files.findOne({ _id: "690b0da8ebb69e59282a28f1" })

// Kết quả mong đợi:
{
  "_id": "690b0da8ebb69e59282a28f1",  ← Khớp với client
  "url": "https://s3.backblaze.com/...",
  "kind": "image",
  "name": "image.png",
  "roomId": "019a258c095c000000eb3d",
  "createdAt": "2025-11-05T..."
}
```

### 4. Kiểm tra State sau upload

**Trong Redux/Zustand DevTools:**

```javascript
messagesRoom: {
  "room-123": {
    messages: [
      {
        id: "msg-1",
        attachments: [
          {
            _id: "690b0da8ebb69e59282a28f1",  ← ID giữ nguyên
            url: "https://s3.../file.png",     ← URL đã update
            kind: "image",
            status: "uploaded",
            uploadProgress: 100,
            file: undefined                     ← File gốc đã xóa
          }
        ]
      }
    ]
  }
}
```

### 5. Kiểm tra Socket Event

**Message được emit:**

```javascript
socket.emit("message:send", {
  roomId: "room-123",
  id: "msg-1",
  content: "Test message",
  attachments: [
    "690b0da8ebb69e59282a28f1",  ← Chỉ gửi ID
    "690b0da8ebb69e59282a28f2"
  ]
})
```

## Common Issues & Solutions

### ❌ Issue 1: IDs không khớp

**Hiện tượng:**

```
🔍 Verifying IDs match:
  File 0: ❌ 690b0da8ebb69e59282a28f1 !== 690b0da8ebb69e59282a28f3
```

**Nguyên nhân:** Đang generate ID mới thay vì dùng `att._id`

**Fix:** Sử dụng `id: filesToUpload.map(att => att._id)`

### ❌ Issue 2: Response không có metadata.\_id

**Hiện tượng:**

```
Error: Cannot read property '_id' of undefined
```

**Nguyên nhân:** Backend chưa trả đúng format

**Fix:** Kiểm tra backend response có đúng structure:

```json
{
  "metadata": {
    "_id": "...",
    "url": "...",
    "kind": "...",
    "name": "..."
  }
}
```

### ❌ Issue 3: File upload nhưng không hiển thị

**Hiện tượng:** Progress lên 100% nhưng file không thấy

**Nguyên nhân:** `updatedAttachments` không được cập nhật vào state

**Debug:**

```javascript
console.log("Updated attachments:", updatedAttachments);
console.log("Current room:", get().messagesRoom[roomId]);
```

### ❌ Issue 4: Database có file nhưng ID khác

**Hiện tượng:** Database có file nhưng `_id` khác với client

**Nguyên nhân:** Backend tự generate ID mới thay vì dùng `id` từ request

**Fix Backend:**

```javascript
// Backend phải dùng id từ request
const fileId = req.body.id || new ObjectId().toString();

// Lưu với ID này
const file = await File.create({
  _id: fileId, // ← Quan trọng!
  url: uploadedUrl,
  kind: fileKind,
  name: fileName,
});
```

## Test Checklist

- [ ] Console log hiển thị đúng IDs before upload
- [ ] Network request gửi đúng `id` trong FormData
- [ ] Response trả về `metadata._id` khớp với ID đã gửi
- [ ] Verification log hiển thị ✅ cho tất cả files
- [ ] State cập nhật với URL thật, giữ nguyên `_id`
- [ ] Socket emit gửi đúng mảng IDs
- [ ] Database có records với `_id` khớp
- [ ] UI hiển thị files với URL từ S3
- [ ] Refresh page vẫn thấy files (từ IndexedDB)

## Debugging Commands

### Log tất cả FilePreview IDs

```javascript
console.log(
  "FilePreview IDs:",
  attachments.map((att) => ({ name: att.name, id: att._id }))
);
```

### Log upload request payload

```javascript
// Trong uploadSingleWithProgress
console.log("Upload payload:", {
  fileName: file.name,
  roomId: options?.roomId,
  fileId: options?.id,
});
```

### Log response transformation

```javascript
// Trong transformUploadResponse
console.log("Transform:", {
  input: apiResp.metadata,
  output: { _id: apiResp.metadata._id, url: apiResp.metadata.url },
});
```

### Verify state after upload

```javascript
const state = useMessageStore.getState();
console.log(
  "Message attachments:",
  state.messagesRoom[roomId]?.messages.find((m) => m.id === messageId)
    ?.attachments
);
```

## Expected Flow Timeline

```
T+0ms:   User chọn file
         → FilePreview._id generated

T+100ms: User click Send
         → Message created với status="uploading"
         → uploadAttachments() started

T+200ms: API requests sent
         → FormData với id = FilePreview._id

T+2s:    Upload progress updates
         → updateAttachmentProgress() called

T+5s:    Upload complete
         → Response received
         → IDs verified ✅

T+5.1s:  State updated
         → attachments.url updated
         → status = "uploaded"

T+5.2s:  Socket emitted
         → attachments: [id1, id2, ...]

T+5.3s:  Message status updated
         → status = "sent"
```

## Verification Script

Chạy trong console để verify toàn bộ flow:

```javascript
async function verifyUploadFlow(roomId, messageId) {
  const state = useMessageStore.getState();
  const message = state.messagesRoom[roomId]?.messages.find(
    (m) => m.id === messageId
  );

  if (!message) {
    console.error("❌ Message not found");
    return;
  }

  console.log("Message:", message);

  // Check attachments
  const attachments = message.attachments || [];
  console.log(`Files: ${attachments.length}`);

  attachments.forEach((att, idx) => {
    console.log(`\nFile ${idx}:`);
    console.log(`  Name: ${att.name}`);
    console.log(`  ID: ${att._id}`);
    console.log(`  URL: ${att.url}`);
    console.log(`  Status: ${att.status}`);
    console.log(`  Kind: ${att.kind}`);

    // Verify URL is real (not blob)
    const isRealUrl = att.url.startsWith("http");
    console.log(`  Real URL: ${isRealUrl ? "✅" : "❌"}`);

    // Verify no file reference
    const noFileRef = !att.file;
    console.log(`  No File ref: ${noFileRef ? "✅" : "❌"}`);
  });
}

// Usage:
verifyUploadFlow("room-123", "msg-1");
```
