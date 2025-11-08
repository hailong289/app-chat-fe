# Toast System - HeroUI Integration

## 📋 Overview

Toast notification system sử dụng Zustand để quản lý state và HeroUI styling. Toast hiển thị ở góc trên bên phải màn hình với animations mượt mà.

## 🎯 Features

- ✅ **4 loại toast**: Success, Error, Warning, Info
- ✅ **Auto dismiss**: Tự động đóng sau thời gian cấu hình
- ✅ **Manual close**: Nút X để đóng thủ công
- ✅ **Action buttons**: Thêm nút action tùy chỉnh
- ✅ **Animations**: Framer Motion cho smooth transitions
- ✅ **Dark mode support**: Tự động adapt với theme
- ✅ **Stack management**: Hiển thị nhiều toast cùng lúc
- ✅ **Type-safe**: Full TypeScript support

## 🚀 Usage

### Basic Usage

```typescript
import { toast } from "@/store/useToastStore";

// Success toast
toast.success("Đăng nhập thành công!", "Chào mừng");

// Error toast
toast.error("Sai mật khẩu", "Lỗi đăng nhập");

// Warning toast
toast.warning("Bạn chưa lưu thay đổi", "Cảnh báo");

// Info toast
toast.info("Có 3 tin nhắn mới", "Thông báo");
```

### Advanced Usage

```typescript
// Custom duration (ms)
toast.success("Saved!", undefined, 3000);

// Toast không tự đóng
toast.error("Critical error", "Error", 0);

// Toast với action button
toast.custom({
  type: "info",
  title: "Cập nhật mới",
  message: "Phiên bản 2.0 đã sẵn sàng",
  duration: 10000,
  action: {
    label: "Cập nhật ngay",
    onClick: () => {
      window.location.reload();
    },
  },
});
```

### In React Components

```tsx
import { toast } from "@/store/useToastStore";

function MyComponent() {
  const handleSubmit = async () => {
    try {
      await api.submit();
      toast.success("Gửi thành công!");
    } catch (error) {
      toast.error("Gửi thất bại. Vui lòng thử lại.");
    }
  };

  return <button onClick={handleSubmit}>Submit</button>;
}
```

### Socket Integration Example

```tsx
// SocketStatusIndicator.tsx
import { toast } from "@/store/useToastStore";

useEffect(() => {
  if (status === "connected") {
    toast.success("Đã kết nối với server", "Kết nối thành công");
  }

  if (status === "error") {
    toast.error(
      "Không thể kết nối. Vui lòng kiểm tra mạng.",
      "Lỗi kết nối",
      0 // Không tự đóng
    );
  }
}, [status]);
```

## 📦 File Structure

```
src/
├── store/
│   └── useToastStore.ts          # Toast state management
├── components/
│   └── toast/
│       ├── ToastContainer.tsx    # Toast renderer
│       └── ToastDemo.tsx         # Demo component (dev only)
└── app/
    └── layout.tsx                # ToastContainer placement
```

## 🎨 Toast Types & Colors

| Type    | Color | Icon                | Use Case             |
| ------- | ----- | ------------------- | -------------------- |
| Success | Green | CheckCircle         | Thành công, hoàn tất |
| Error   | Red   | ExclamationCircle   | Lỗi, thất bại        |
| Warning | Amber | ExclamationTriangle | Cảnh báo, chú ý      |
| Info    | Blue  | InformationCircle   | Thông tin, gợi ý     |

## ⚙️ Configuration

### Default Settings

```typescript
// useToastStore.ts
{
  duration: 5000,      // Auto close sau 5s
  placement: "top-right", // Vị trí hiển thị
  maxToasts: 5,        // Tối đa 5 toast cùng lúc
}
```

### Customization

Thay đổi vị trí toast trong `ToastContainer.tsx`:

```tsx
// Top left
<div className="fixed top-4 left-4 z-[9999]">

// Bottom right
<div className="fixed bottom-4 right-4 z-[9999]">

// Top center
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">
```

## 🎭 Animation Settings

```typescript
// ToastContainer.tsx
initial={{ opacity: 0, y: -20, scale: 0.95 }}
animate={{ opacity: 1, y: 0, scale: 1 }}
exit={{ opacity: 0, x: 100, scale: 0.95 }}
transition={{ duration: 0.2 }}
```

## 🧪 Testing

Sử dụng `ToastDemo` component để test:

```tsx
// Thêm vào page cần test
import ToastDemo from "@/components/toast/ToastDemo";

export default function Page() {
  return (
    <>
      <ToastDemo /> {/* Hiện nút test ở bottom-right */}
      {/* Your page content */}
    </>
  );
}
```

## 📝 API Reference

### `toast.success(message, title?, duration?)`

- **message**: string - Nội dung chính
- **title**: string (optional) - Tiêu đề
- **duration**: number (optional) - Thời gian hiển thị (ms), 0 = không tự đóng

### `toast.error(message, title?, duration?)`

Tương tự `success`

### `toast.warning(message, title?, duration?)`

Tương tự `success`

### `toast.info(message, title?, duration?)`

Tương tự `success`

### `toast.custom(options)`

```typescript
{
  type: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Store Methods

```typescript
import { useToastStore } from "@/store/useToastStore";

const { toasts, removeToast, clearAll } = useToastStore();

// Remove specific toast
removeToast(toastId);

// Clear all toasts
clearAll();
```

## 🎯 Best Practices

1. **Keep messages short**: Tối đa 2 dòng
2. **Use appropriate types**: Success cho thành công, Error cho lỗi
3. **Add titles for important messages**: Giúp user hiểu nhanh hơn
4. **Set duration wisely**:
   - Success: 3-5s
   - Error: 0 (manual close) hoặc 7-10s
   - Warning: 7-10s
   - Info: 5s
5. **Use actions sparingly**: Chỉ khi cần user thực hiện hành động cụ thể
6. **Don't spam**: Tránh hiện quá nhiều toast cùng lúc

## 🔧 Troubleshooting

**Toast không hiển thị:**

- Kiểm tra `ToastContainer` đã được thêm vào `layout.tsx`
- Kiểm tra z-index (phải > các element khác)
- Kiểm tra console có lỗi không

**Toast bị che khuất:**

- Tăng z-index: `z-[9999]`
- Thay đổi vị trí placement

**Animation không mượt:**

- Kiểm tra `framer-motion` đã được cài
- Giảm số lượng toast hiển thị cùng lúc

## 📚 References

- [HeroUI Documentation](https://www.heroui.com/docs/components/toast)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Framer Motion](https://www.framer.com/motion/)

---

Created: November 2025
Version: 1.0.0
