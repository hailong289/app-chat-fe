# File Gallery Components

## 🎯 Tổng quan

Hệ thống hiển thị files (ảnh, video, audio, documents) dạng gallery với modal xem chi tiết và real-time upload progress tracking.

## 📦 Components

### 1. **FileGallery** (Full Gallery)

Gallery đầy đủ với grid 3 cột, hiển thị tất cả files.

### 2. **CompactFileGallery** (Compact Gallery)

Gallery compact cho chat messages với layout thông minh:

- 1 file: Full width
- 2 files: 2 cột
- 3 files: Asymmetric (1 lớn + 2 nhỏ)
- 4+ files: Grid 2x2 với "+N more" button

## ✨ Tính năng

### Upload Progress Tracking

- ✅ Hiển thị progress bar khi file đang upload
- ✅ Percentage (0-100%)
- ✅ Visual feedback cho trạng thái: uploading, uploaded, failed
- ✅ Không cho click vào file khi đang upload

### Modal View

- ✅ Click vào file → Mở modal full screen
- ✅ Hiển thị preview cho: ảnh, video, audio
- ✅ Download button cho files không preview được
- ✅ Upload progress trong modal
- ✅ Responsive design

### File Type Support

- 📸 **Photo**: Thumbnail + full preview
- 🎬 **Video**: Thumbnail với play icon + video player
- 🎵 **Audio**: Icon + audio player
- 📄 **File**: Icon + download button

## 🔧 API Reference

### CompactFileGallery

```tsx
<CompactFileGallery
  files={FilePreview[]}       // Required: Array of files
  maxDisplay={number}         // Optional: Max files to show (default: 4)
  className={string}          // Optional: Additional CSS classes
/>
```

### FileGallery

```tsx
<FileGallery
  files={FilePreview[]}       // Required: Array of files
  className={string}          // Optional: Additional CSS classes
/>
```

## 📝 Usage Examples

### Example 1: Trong Chat Messages

```tsx
import { CompactFileGallery } from "@/components/CompactFileGallery";

export const ChatMessage = ({ message }) => {
  return (
    <div className="message-bubble">
      <p>{message.content}</p>

      {message.attachments && message.attachments.length > 0 && (
        <CompactFileGallery files={message.attachments} maxDisplay={4} />
      )}
    </div>
  );
};
```

### Example 2: Full Gallery View

```tsx
import { FileGallery } from "@/components/FileGallery";

export const MediaPage = () => {
  const allMedia = useMessageStore((state) =>
    getAllMediaFromRoom(state, roomId)
  );

  return <FileGallery files={allMedia} />;
};
```

### Example 3: With Upload Progress

```tsx
const message = {
  id: "msg-123",
  content: "Check these photos!",
  attachments: [
    {
      _id: "file-1",
      kind: "photo",
      url: "blob:http://localhost:3000/...",
      name: "photo1.jpg",
      size: 2048576,
      mimeType: "image/jpeg",
      status: "uploading",        // ← Đang upload
      uploadProgress: 45,         // ← Progress 45%
      file: File {...}
    },
    {
      _id: "file-2",
      kind: "photo",
      url: "https://cdn.../photo2.jpg",
      name: "photo2.jpg",
      size: 1024576,
      mimeType: "image/jpeg",
      status: "uploaded",         // ← Đã upload xong
      uploadProgress: 100
    }
  ]
};

<CompactFileGallery files={message.attachments} />
```

## 🎨 Layout Patterns

### 1 File

```
┌─────────────────┐
│                 │
│    Full Width   │
│                 │
└─────────────────┘
```

### 2 Files

```
┌────────┬────────┐
│        │        │
│  File1 │ File2  │
│        │        │
└────────┴────────┘
```

### 3 Files (Asymmetric)

```
┌────────┬────────┐
│        │ File2  │
│ File1  ├────────┤
│        │ File3  │
└────────┴────────┘
```

### 4+ Files

```
┌────────┬────────┐
│ File1  │ File2  │
├────────┼────────┤
│ File3  │  +N    │ ← Click to show all
└────────┴────────┘
```

## 🔄 Progress States

### Pending (Chưa upload)

```tsx
{
  status: "pending",
  uploadProgress: 0,
  url: "blob:http://localhost:3000/..." // Local preview
}
```

**UI**: Normal thumbnail, có thể click

### Uploading (Đang upload)

```tsx
{
  status: "uploading",
  uploadProgress: 45,
  url: "blob:http://localhost:3000/..."
}
```

**UI**:

- Thumbnail có overlay mờ
- Progress bar + percentage
- Không thể click (disabled)

### Uploaded (Đã upload)

```tsx
{
  status: "uploaded",
  uploadProgress: 100,
  url: "https://cdn.../file.jpg",      // Remote URL
  uploadedUrl: "https://cdn.../file.jpg"
}
```

**UI**: Normal thumbnail, có thể click xem full

### Failed (Upload thất bại)

```tsx
{
  status: "failed",
  uploadProgress: 0,
  url: "blob:http://localhost:3000/..."
}
```

**UI**:

- Red overlay với "Upload Failed"
- Có thể retry (tùy implementation)

## 🎬 Modal Features

### Photo Modal

- Full resolution image
- Click to close
- Download button
- File info (name, size, type)

### Video Modal

- Video player với controls
- Play/pause, volume, fullscreen
- File info

### Audio Modal

- Audio player
- Waveform visualization (optional)
- File info

### Document Modal

- Preview not available message
- Download button
- File info

## 🔧 Customization

### Custom Thumbnail Size

```tsx
// In CompactFileGallery.tsx
<div
  className="relative cursor-pointer rounded-lg overflow-hidden"
  style={{ aspectRatio: "1/1" }}  // ← Change aspect ratio
>
```

### Custom Grid Layout

```tsx
// Change from 2 columns to 3
{files.length >= 4 && (
  <div className="grid grid-cols-3 gap-1">  // ← Was grid-cols-2
    {displayFiles.map(...)}
  </div>
)}
```

### Custom Progress UI

```tsx
{
  isUploading && (
    <div className="absolute inset-0 bg-black/60 flex flex-col">
      {/* Custom progress component */}
      <CircularProgress value={file.uploadProgress} />
    </div>
  );
}
```

## 📊 Data Flow

### 1. User selects files

```
File Input → toPreviews() → FilePreview[] with blob URLs
```

### 2. Display in gallery

```
FilePreview[] → CompactFileGallery → Thumbnails rendered
```

### 3. Upload starts

```
uploadAttachments() → Progress callbacks → updateAttachmentProgress()
↓
FilePreview.uploadProgress updated
↓
Gallery re-renders with progress
```

### 4. Upload completes

```
FilePreview.url updated to remote URL
↓
FilePreview.status = "uploaded"
↓
Gallery shows normal thumbnail
```

## ⚙️ Performance Tips

### 1. **Lazy Load Images**

```tsx
<img
  src={file.url}
  loading="lazy" // ← Browser native lazy loading
  alt={file.name}
/>
```

### 2. **Thumbnail Generation**

```tsx
// Generate thumbnails for large images
const thumbnail = await generateThumbnail(file, { width: 200, height: 200 });
```

### 3. **Virtual Scrolling**

For large galleries (100+ files), use virtual scrolling:

```tsx
import { FixedSizeGrid } from "react-window";
```

### 4. **Memoization**

```tsx
const MemoizedGallery = React.memo(CompactFileGallery);
```

## 🐛 Common Issues

### Issue 1: Progress không update

**Cause**: Component không re-render khi progress thay đổi
**Solution**: Đảm bảo state được update properly trong Zustand

### Issue 2: Modal không đóng

**Cause**: Click event bubbling
**Solution**:

```tsx
onClick={(e) => {
  e.stopPropagation();
  handleClose();
}}
```

### Issue 3: Video không play

**Cause**: Browser security policy
**Solution**: Add `controls` attribute và user gesture required

### Issue 4: Blob URL không revoke

**Cause**: Memory leak
**Solution**: Revoke trong useEffect cleanup:

```tsx
useEffect(() => {
  return () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
  };
}, [files]);
```

## 📱 Mobile Considerations

### Touch Gestures

- ✅ Tap to open modal
- ✅ Pinch to zoom (in modal)
- ✅ Swipe to close modal

### Performance

- ✅ Compress images before upload
- ✅ Lazy load thumbnails
- ✅ Limit concurrent uploads

### Layout

- ✅ Responsive grid
- ✅ Touch-friendly tap targets (min 44x44px)
- ✅ Mobile-optimized modal

## 🎯 Best Practices

1. **Always show progress**: User nên biết file đang upload
2. **Preview before upload**: Show thumbnail ngay lập tức
3. **Handle errors gracefully**: Show error message + retry option
4. **Optimize images**: Compress/resize trước khi upload
5. **Accessibility**: Add alt text, keyboard navigation
6. **Security**: Validate file types, scan for malware

## 🔗 Integration

### With MessageStore

```tsx
const message = useMessageStore((state) =>
  state.messagesRoom[roomId]?.messages.find((m) => m.id === messageId)
);

<CompactFileGallery files={message?.attachments || []} />;
```

### With Upload Service

```tsx
// Progress automatically tracked in FilePreview
uploadAttachments(roomId, messageId, files);
// Gallery re-renders as progress updates
```

## ✅ Testing Checklist

- [ ] Display 1 file: Full width
- [ ] Display 2 files: 2 columns
- [ ] Display 3 files: Asymmetric layout
- [ ] Display 4+ files: Grid with "+N"
- [ ] Click file: Open modal
- [ ] Upload progress: Shows in thumbnail
- [ ] Upload progress: Shows in modal
- [ ] Failed upload: Red overlay
- [ ] Video: Play button overlay
- [ ] Audio: Icon + player
- [ ] Document: Download button
- [ ] Modal close: Click X or outside
- [ ] Mobile: Touch gestures work

## 📚 Related Docs

- [UPLOAD_PROGRESS.md](./UPLOAD_PROGRESS.md) - Upload với progress tracking
- [IMAGE_COMPRESSION.md](./IMAGE_COMPRESSION.md) - Nén ảnh trước upload
- [FilePreview Type](../src/store/types/message.state.ts) - Type definition
