# Kế hoạch phát triển Giao diện Mobile Toàn diện và Phân quyền Android

Bạn hoàn toàn chính xác. Kế hoạch trước đó tập trung quá nhiều vào phần tính năng Call mà thiếu đi bức tranh toàn cảnh: **Toàn bộ ứng dụng Chat cần một UI thực sự dành cho Mobile**. 

Dưới đây là kế hoạch chi tiết để tái cấu trúc toàn bộ mã nguồn Frontend để hoạt động trơn tru trên cả Desktop, Web và Mobile (qua Tauri Android).

## User Review Required

> [!IMPORTANT]
> - **Chuyển đổi UX (User Experience):** Trên Desktop, màn hình chia 3 cột (Header Nav -> LeftSide List -> RightSide Chat). Trên Mobile, chúng ta không thể nhồi nhét cả 3 vào màn hình. **Thay đổi đề xuất:**
>   1. `Header` sẽ biến thành thanh **Bottom Navigation** (thanh điều hướng dưới cùng) trên màn hình mobile.
>   2. `LeftSide` (Danh sách Chat, Danh bạ) sẽ chiếm **toàn bộ màn hình** khi mới mở app.
>   3. Khi bấm vào một đoạn Chat, màn hình `ChatDetail` (bên phải) sẽ trượt ra và che toàn bộ danh sách, đồng thời hiện nút "Quay lại (Back)" trên cùng.
> - **Routing & Tương thích Desktop:** Việc thay đổi này sẽ sử dụng hoàn toàn CSS Media Queries (`max-md:`, `md:`) kết hợp với việc kiểm tra `pathname` trong Next.js, đảm bảo **không làm hỏng hay thay đổi trải nghiệm của người dùng trên Desktop**.

## Open Questions

> [!NOTE]
> - Đối với thiết bị di động, khi vuốt mở menu (nếu có) hoặc khi bấm vào hình ảnh, bạn có muốn dùng các component hỗ trợ Swipe/Touch gesture riêng biệt hay chỉ cần sử dụng click thông thường của React? (Tạm thời mình sẽ thiết kế theo Click-based responsive để tối ưu code hiện tại).
> - Tính năng Flashcard và Todo trên điện thoại cũng sẽ chiếm toàn màn hình thay vì chia Layout. Bạn đồng ý với thiết kế này chứ?

---

## Proposed Changes

### 1. Tái cấu trúc Global Layout (Core UI)

Điều chỉnh lại bộ khung của App để hỗ trợ Responsive cho điện thoại di động.

#### [MODIFY] `src/app/client-layout.tsx`
- Sửa lại cấu trúc thẻ `<main>` và `<nav>`. 
- Thêm logic kiểm tra xem người dùng đang ở trang chi tiết (`/chat/[id]`, `/flash-card/[id]`) hay đang ở danh sách.
- **Trên Mobile (dùng Tailwind `max-md:`):** 
  - Nếu đang ở trang danh sách: Ẩn phần `{children}`, hiển thị `<LeftSide />` full-width (100%), và `<Header />` ở dưới cùng màn hình dạng Bottom Navigation.
  - Nếu đang ở trang chi tiết: Ẩn `<LeftSide />` và `<Header />`, để phần `{children}` (Nội dung chat/flashcard) chiếm 100% màn hình.

#### [MODIFY] `src/components/intro/header.tsx`
- Cấu trúc lại CSS của Header:
  - **Desktop (`md:flex-col`, `md:w-15`):** Vẫn là thanh điều hướng bên trái, cuộn dọc.
  - **Mobile (`max-md:flex-row`, `max-md:w-full`, `max-md:fixed`, `max-md:bottom-0`):** Biến thành thanh Navigation ngang dưới đáy màn hình. Các text title sẽ bị ẩn đi, chỉ để lại Icon. 
- Tách phần "Dropdown User/Cài đặt" để hiển thị cho phù hợp trên Bottom Navigation (ví dụ: Icon Avatar chuyển ra góc phải).

#### [MODIFY] `src/components/intro/left-side.tsx`
- Đảm bảo `width` của left-side là `w-full` trên màn hình nhỏ và `w-[320px]` (có thể resize) trên màn hình lớn (`md:`).

---

### 2. Giao diện Chat và Màn hình chi tiết (Detail Pages)

Xử lý trải nghiệm nhắn tin, gửi file để dùng dễ bằng ngón tay thay vì chuột.

#### [MODIFY] `src/components/chat/ChatWindow.tsx` (Hoặc component tương ứng render nội dung chat)
- Thêm thanh Top Bar dành riêng cho Mobile: Chứa nút **Back (<)** để người dùng quay lại `LeftSide` (danh sách chat). (Chỉ hiển thị trên `max-md:`).
- Khung nhập tin nhắn (Chat Input): Xử lý padding-bottom để không bị che khuất bởi bàn phím ảo (Software Keyboard) trên điện thoại (sử dụng CSS `env(safe-area-inset-bottom)`).

#### [MODIFY] Các màn hình Contact, Flashcard, Settings
- Đảm bảo các bảng, danh sách dạng lưới (Grid) trên Desktop tự động chuyển thành danh sách dạng cột (List 1 column) trên Mobile để dễ cuộn.
- Màn hình Settings hiển thị dạng Full-screen thay vì chia modal/panel.

---

### 3. Tích hợp Mobile Permissions & Native APIs (Tauri v2)

Đưa các tính năng Native của Android vào ứng dụng để ứng dụng "giống một App thực thụ".

#### [MODIFY] `src-tauri/Cargo.toml` & `package.json`
- Cài đặt các plugin Native của Tauri v2:
  - `@tauri-apps/plugin-notification` (Thông báo cuộc gọi/tin nhắn trên Android/iOS)
  - `@tauri-apps/plugin-fs` & `@tauri-apps/plugin-dialog` (Gửi tệp, hình ảnh từ điện thoại)
  - `@tauri-apps/plugin-os` (Nhận diện OS)

#### [MODIFY] `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- Bổ sung quyền phần cứng vào Android Manifest:
  - `android.permission.CAMERA` & `android.permission.RECORD_AUDIO`
  - `android.permission.POST_NOTIFICATIONS` (Cho Android 13+)
  - `android.permission.READ_MEDIA_IMAGES` / `android.permission.READ_EXTERNAL_STORAGE`

#### [NEW] `src/utils/permissions.ts`
- Tạo hàm bọc để gọi xin quyền Native thông qua Plugin trước khi App truy cập Camera hoặc gửi file nếu người dùng đang dùng App trên điện thoại.

#### [MODIFY] `src/store/useCallStore.ts` & Layout màn hình Call
- **Notification:** Thay thế Web API `Notification` bằng Tauri Plugin khi chạy trên Android để chuông đổ native.
- **Cửa sổ Gọi (Window):** Do Android không hỗ trợ `window.open` tốt, thay đổi hành vi: 
  - Nếu Desktop: Giữ nguyên mở cửa sổ Popup.
  - Nếu Mobile: Redirect toàn bộ màn hình sang route `/call` ngay trong App chính.
- **UI màn hình Call:** Layout xếp video dọc, thu nhỏ các nút (Tắt mic, tắt camera) xuống nửa dưới màn hình để dễ chạm bằng ngón cái.

---

## Verification Plan

### Automated Tests
- Chạy `npm run dev` để kiểm tra Desktop không bị vỡ giao diện.
- Test chức năng Resize Sidebar trên Desktop xem có bị ảnh hưởng bởi logic Mobile không.

### Manual Verification (Mobile App Testing)
- **Kiểm tra UI/UX:**
  1. Mở App trên giả lập Android (`npm run android:dev`).
  2. Ở màn hình chính, thanh điều hướng nằm ở DƯỚI CÙNG, danh sách chat chiếm toàn màn hình.
  3. Bấm vào một bạn bè -> Chuyển vào màn hình Chat full-screen, mất thanh điều hướng dưới cùng, hiện nút Back ở trên cùng.
  4. Bấm Back -> Quay về danh sách chat.
- **Kiểm tra Permissions & Native:**
  1. Bấm nút Call -> Trình duyệt bật hộp thoại Android xin quyền Mic/Camera.
  2. Chọn gửi ảnh trong Chat -> Mở thư viện ảnh (Gallery) gốc của Android.
  3. Ẩn App ra nền -> Người khác gọi đến -> Màn hình Android hiện thanh Notification gốc của máy.
