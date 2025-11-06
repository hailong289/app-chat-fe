# Hướng dẫn sử dụng tính năng nén ảnh

## 🎯 Tổng quan

Hệ thống hỗ trợ **tự động nén ảnh** trước khi gửi để giảm dung lượng file, tiết kiệm băng thông và tăng tốc độ upload.

## ✨ Tính năng

### 1. **Nén ảnh tự động**

- Sử dụng thư viện `browser-image-compression`
- Nén trong browser (client-side), không cần server
- Chỉ nén file ảnh, bỏ qua video/audio/documents

### 2. **Toggle ON/OFF**

- Người dùng có thể **BẬT/TẮT** nén ảnh bằng switch
- Chỉ hiện switch khi có ảnh trong attachments
- Mặc định: **TẮT** (giữ nguyên file gốc)

### 3. **Cấu hình nén**

```typescript
const compressionOptions = {
  maxSizeMB: 10, // Nén tối đa xuống 10MB
  maxWidthOrHeight: 1920, // Resize xuống max 1920px
  useWebWorker: true, // Dùng Web Worker để không block UI
  initialQuality: 0.8, // Chất lượng 80%
};
```

## 📝 Cách sử dụng

### Trong Component

```tsx
import { FileAcceptConfig } from "@/libs/file-handlers";

const [compressImages, setCompressImages] = useState(false);

const config: FileAcceptConfig = {
  ...defaultConfig,
  compressImages, // true/false từ toggle
  compressQuality: 0.8, // Optional: custom quality
};
```

### UI Switch

```tsx
{
  attachments.some((att) => att.kind === "photo") && (
    <div className="flex items-center justify-between">
      <span>Nén ảnh trước khi gửi</span>
      <Switch isSelected={compressImages} onValueChange={setCompressImages} />
    </div>
  );
}
```

## 🔧 API Reference

### `compressImage(file: File, quality?: number): Promise<File>`

Nén 1 ảnh.

**Params:**

- `file`: File ảnh cần nén
- `quality`: Chất lượng (0-1), mặc định 0.8

**Returns:** File đã nén hoặc file gốc nếu lỗi

**Example:**

```typescript
const compressed = await compressImage(imageFile, 0.9);
console.log(`${imageFile.size} → ${compressed.size}`);
```

### `compressFiles(files: File[], quality?: number, onProgress?: (current, total) => void): Promise<File[]>`

Nén nhiều files với progress tracking.

**Params:**

- `files`: Mảng files cần nén
- `quality`: Chất lượng (0-1)
- `onProgress`: Callback để track tiến trình

**Example:**

```typescript
const compressed = await compressFiles(files, 0.8, (current, total) =>
  console.log(`${current}/${total}`)
);
```

## 📊 Kết quả thực tế

**Test case: IMG_4563.MOV (26.3MB)**

- Không nén: ❌ Quá giới hạn 20MB → **Tăng lên 50MB**
- Video không được nén (chỉ nén ảnh)

**Test case: Photo (5MB PNG)**

- Không nén: 5MB
- Nén 80%: ~1.2MB **(giảm 76%)**
- Nén 60%: ~0.8MB **(giảm 84%)**

## ⚙️ Cấu hình

### Giới hạn file

```typescript
export const defaultConfig: FileAcceptConfig = {
  accept: ["image/*", "video/*", "application/pdf"],
  maxFiles: 10,
  maxSizeMB: 50, // Tăng lên 50MB cho video
  compressImages: false, // Mặc định không nén
  compressQuality: 0.8, // Chất lượng 80%
};
```

### Loại file không nén

- GIF (giữ animation)
- SVG (vector, không cần nén)
- Video (cần server-side processing)
- Audio, PDF, Documents

## 🐛 Xử lý lỗi

```typescript
try {
  const compressed = await compressImage(file);
  console.log("✅ Compressed successfully");
} catch (error) {
  console.error("❌ Compression failed:", error);
  // Tự động fallback về file gốc
}
```

## 📱 Browser Support

- ✅ Chrome/Edge (Web Worker support)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE: Không hỗ trợ (fallback về file gốc)

## 🚀 Performance

- **Web Worker**: Không block UI thread
- **Async**: Không block user interaction
- **Memory**: Giải phóng blob URL sau khi dùng
- **Progress**: Track tiến trình nén

## 🔍 Debug Logs

```
🗜️ Compressing image: photo.jpg (5.23MB)
✅ Compressed: photo.jpg | 5.23MB → 1.18MB (77.4% reduction)
```

```
⏭️ Skipping compression (GIF/SVG): animation.gif
⏭️ Skipping compression (not an image): video.mp4
```

## 💡 Best Practices

1. **Để user chọn**: Không force nén, để toggle ON/OFF
2. **Show progress**: Hiển thị progress bar khi nén nhiều files
3. **Fallback**: Luôn có plan B nếu nén thất bại
4. **Quality balance**: 0.8 là điểm cân bằng tốt (quality vs size)
5. **Size check**: Kiểm tra lại size sau khi nén

## 📦 Dependencies

```json
{
  "browser-image-compression": "^2.0.2"
}
```

Cài đặt:

```bash
yarn add browser-image-compression
# hoặc
npm install browser-image-compression
```

## 🎓 Notes

- Nén ảnh là **lossless/lossy** tùy theo format
- JPEG: lossy compression (mất một ít quality)
- PNG: có thể lossy hoặc lossless
- WebP: hỗ trợ cả hai
- Resize xuống 1920px vẫn đủ cho hầu hết use cases (web, mobile)
