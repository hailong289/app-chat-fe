# Upload Attachments với Progress Tracking

## 🎯 Tổng quan

Hệ thống upload file với real-time progress tracking, cập nhật trực tiếp vào message state và hiển thị cho user.

## ✨ Tính năng

### 1. **Upload Song Song (Parallel)**

- Upload nhiều files cùng lúc với `uploadMultipleParallel`
- Tracking progress riêng cho từng file
- Tối ưu tốc độ upload

### 2. **Real-time Progress**

- Cập nhật progress (0-100%) vào message state
- Hiển thị progress bar cho từng file
- Status: "pending" → "uploading" → "uploaded" / "failed"

### 3. **State Management**

- Progress được lưu trong `messagesRoom[roomId].messages[].attachments[]`
- Tự động cập nhật UI khi progress thay đổi
- Revoke blob URL sau khi upload thành công

## 📝 Flow hoạt động

### 1. **User chọn files**

```typescript
// File được convert thành FilePreview với blob URL
const previews = toPreviews(files);
// => { _id, url: "blob:...", file: File, status: "pending", ... }
```

### 2. **User gửi message**

```typescript
sendMessage({
  roomId,
  content,
  attachments: previews, // Chứa File gốc
  socket,
  userId,
  ...
});
```

### 3. **Message được tạo ngay lập tức**

```typescript
// Message hiển thị với status: "uploading"
const message = {
  id: "msg-123",
  content: "Check this out!",
  attachments: previews,
  status: "uploading", // ← Hiển thị loading state
};
```

### 4. **Upload bắt đầu (background)**

```typescript
uploadAttachments(roomId, messageId, attachments).then((uploaded) => {
  // ✅ Upload thành công
  // Emit socket với URLs thật
  socket.emit("message:send", {
    id: messageId,
    attachments: uploaded.map((att) => ({ url: att.uploadedUrl })),
  });
});
```

### 5. **Progress được cập nhật real-time**

```typescript
// Callback từ UploadService.uploadMultipleParallel
onEachProgress: (index, progress) => {
  // 📤 File 0: 25%
  // 📤 File 1: 50%
  updateAttachmentProgress(roomId, messageId, fileId, progress, "uploading");
};
```

### 6. **State update flow**

```
FilePreview trong message:
{ status: "pending", uploadProgress: 0 }
         ↓
{ status: "uploading", uploadProgress: 25 }
         ↓
{ status: "uploading", uploadProgress: 50 }
         ↓
{ status: "uploading", uploadProgress: 100 }
         ↓
{ status: "uploaded", url: "https://cdn.../file.jpg", uploadedUrl: "..." }
```

## 🔧 API Reference

### `uploadAttachments(roomId, messageId, attachments)`

Upload tất cả attachments với progress tracking.

**Params:**

- `roomId`: ID của room
- `messageId`: ID của message chứa attachments
- `attachments`: Mảng FilePreview (phải có `file` property)

**Returns:** `Promise<FilePreview[]>` - Attachments đã upload với URLs thật

**Example:**

```typescript
const uploaded = await messageStore.uploadAttachments(
  "room-123",
  "msg-456",
  [
    { _id: "file-1", file: File, ... },
    { _id: "file-2", file: File, ... },
  ]
);

console.log(uploaded);
// [
//   { _id: "file-1", url: "https://cdn.../1.jpg", status: "uploaded" },
//   { _id: "file-2", url: "https://cdn.../2.jpg", status: "uploaded" },
// ]
```

### `updateAttachmentProgress(roomId, messageId, fileId, progress, status?)`

Cập nhật progress của một file cụ thể.

**Params:**

- `roomId`: ID của room
- `messageId`: ID của message
- `fileId`: ID của file (`attachment._id`)
- `progress`: 0-100
- `status`: "pending" | "uploading" | "uploaded" | "failed"

**Example:**

```typescript
messageStore.updateAttachmentProgress(
  "room-123",
  "msg-456",
  "file-1",
  75,
  "uploading"
);
```

## 📊 Data Structure

### FilePreview (Extended)

```typescript
type FilePreview = {
  _id: string; // Unique ID
  kind: "photo" | "video" | "audio" | "file";
  url: string; // Blob URL → Real URL sau upload
  uploadedUrl?: string; // URL thật sau khi upload
  name: string;
  size: number;
  mimeType: string;
  status?: "pending" | "uploading" | "uploaded" | "failed";
  uploadProgress?: number; // 0-100
  file?: File; // File gốc để upload
};
```

### Message với Attachments

```typescript
type MessageType = {
  id: string;
  content: string;
  attachments?: FilePreview[];
  status: "pending" | "uploading" | "uploaded" | "sent" | "failed";
};
```

### State Structure

```typescript
messagesRoom: {
  "room-123": {
    messages: [
      {
        id: "msg-1",
        content: "Hello",
        attachments: [
          {
            _id: "file-1",
            url: "blob:http://localhost:3000/...",
            status: "uploading",
            uploadProgress: 45,
            file: File {...}
          }
        ],
        status: "uploading"
      }
    ]
  }
}
```

## 🎨 UI Components

### Display Upload Progress

```tsx
import { FileUploadProgress } from "@/components/FileUploadProgress";

// Trong ChatMessages.tsx
{
  msg.attachments?.map((att) => (
    <div key={att._id}>
      {att.kind === "photo" && <img src={att.url} alt={att.name} />}

      {/* Hiển thị progress khi đang upload */}
      <FileUploadProgress attachment={att} />
    </div>
  ));
}
```

### FileUploadProgress Component

```tsx
const FileUploadProgress = ({ attachment }) => {
  if (attachment.status !== "uploading") return null;

  return (
    <div className="upload-progress">
      <p>{attachment.name}</p>
      <Progress value={attachment.uploadProgress} />
      <span>{attachment.uploadProgress}%</span>
    </div>
  );
};
```

## 🚀 Usage Example

### Complete Flow

```typescript
// 1. User picks files
const files = await getFilesFromInput();
const previews = toPreviews(files);

// 2. Set attachments to state
setAttachments(previews);

// 3. User clicks send
const sendMessage = async () => {
  await messageStore.sendMessage({
    roomId: "room-123",
    content: "Check these files!",
    attachments: previews, // Contains File objects
    socket,
    userId,
    userFullname,
    userAvatar,
  });

  // Message hiển thị ngay với blob URLs
  // Upload diễn ra background
  // Progress tự động update
  // Sau khi upload xong, URLs được replace
};
```

### Monitor Progress

```typescript
// Trong component
const message = useMessageStore((state) =>
  state.messagesRoom[roomId]?.messages.find((m) => m.id === messageId)
);

// Watch progress changes
useEffect(() => {
  message?.attachments?.forEach((att) => {
    console.log(`${att.name}: ${att.uploadProgress}% (${att.status})`);
  });
}, [message]);
```

## ⚙️ Configuration

### Upload Settings

```typescript
// trong uploadAttachments()
const uploadedResults = await UploadService.uploadMultipleParallel(files, {
  folder: "message", // Thư mục lưu trên server
  onEachProgress: (idx, pct) => {
    // Update progress callback
  },
});
```

### Error Handling

```typescript
try {
  await uploadAttachments(roomId, messageId, attachments);
} catch (error) {
  // Tất cả files được mark là "failed"
  // User có thể retry
  console.error("Upload failed:", error);
}
```

## 🔍 Debugging

### Console Logs

```
🚀 Starting upload for 3 files
📤 Upload progress [0]: 25% photo1.jpg
📤 Upload progress [1]: 10% video.mp4
📤 Upload progress [2]: 50% document.pdf
📤 Upload progress [0]: 50% photo1.jpg
📤 Upload progress [1]: 30% video.mp4
...
✅ All files uploaded: [{ url: "..." }, ...]
✅ Upload complete, updating message...
```

### State Inspection

```typescript
// Chrome DevTools
useMessageStore.getState().messagesRoom["room-123"].messages[0].attachments;
```

## 📱 Mobile Considerations

- **Large files**: Hiển thị estimated time
- **Network interruption**: Auto-retry hoặc manual retry button
- **Background upload**: Continue khi minimize app
- **Upload queue**: Limit concurrent uploads (đã handle bởi parallel upload)

## 🎯 Best Practices

1. **Revoke blob URLs**: Sau khi upload xong để tránh memory leak
2. **Show progress**: Luôn hiển thị progress cho UX tốt
3. **Handle errors**: Cho phép user retry failed uploads
4. **Optimize images**: Nén trước khi upload (đã có compression feature)
5. **Cancel support**: Implement AbortController cho long uploads

## 📚 Related Docs

- [IMAGE_COMPRESSION.md](./IMAGE_COMPRESSION.md) - Nén ảnh trước upload
- [CROSS_STORE_USAGE.md](./CROSS_STORE_USAGE.md) - Gọi store khác
- [TIMELINE.md](./TIMELINE.md) - Hiển thị messages theo timeline

## 🔗 Integration Points

### With Compression

```typescript
// Nén trước, sau đó upload
const compressedFiles = await compressFiles(files);
const previews = toPreviews(compressedFiles);
sendMessage({ attachments: previews });
```

### With Room Store

```typescript
// Update room's last_message sau khi upload xong
const roomStore = useRoomStore.getState();
roomStore.updateRoomSocket({
  last_message: {
    content: message.content,
    attachments: uploadedAttachments.length,
  },
});
```

## ✅ Testing Checklist

- [ ] Upload single file: Progress 0% → 100%
- [ ] Upload multiple files: All progress tracked
- [ ] Large file (>50MB): Progress smooth
- [ ] Network error: Status changed to "failed"
- [ ] Retry after fail: Works correctly
- [ ] Blob URL cleanup: No memory leaks
- [ ] UI updates: Progress bars render
- [ ] Socket emit: Correct data sent after upload
