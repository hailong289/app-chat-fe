# App Chat FE

Ứng dụng chat frontend được xây dựng với Next.js 15 và Tauri, tạo ra một ứng dụng desktop hiện đại với giao diện web.

## 🚀 Công nghệ sử dụng

### Frontend
- **Next.js 15** - React framework với App Router và Turbopack
- **React 19** - Thư viện UI hiện đại 
- **TypeScript** - Ngôn ngữ lập trình có type safety
- **Tailwind CSS 4** - CSS framework utility-first

### Desktop App
- **Tauri 2** - Framework để tạo ứng dụng desktop với Rust backend
- **Rust** - Ngôn ngữ lập trình hệ thống an toàn và hiệu suất cao

## 📋 Yêu cầu hệ thống

- Node.js 20+ 
- Rust 1.77.2+
- npm hoặc yarn

## 🛠️ Cài đặt và chạy dự án

### 1. Clone repository
```bash
git clone <repository-url>
cd app-chat-fe
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Chạy ứng dụng

#### Chế độ development (web)
```bash
npm run dev
```
Mở [http://localhost:3000](http://localhost:3000) để xem ứng dụng web.

#### Chạy ứng dụng desktop (Tauri)
```bash
npm run tauri dev
```

- Nếu lỗi cargo metadata thì cài đặt rust (do chưa có rust). Chạy lệnh
```bash
winget install --id Rustlang.Rustup -e
```

### 4. Build ứng dụng

#### Build web application
```bash
npm run build
```

#### Build desktop application
```bash
npm run tauri build
```

## 📁 Cấu trúc dự án

```
app-chat-fe/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Layout chính
│   ├── page.tsx           # Trang chủ
│   └── globals.css        # CSS toàn cục
├── src-tauri/             # Tauri backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   └── lib.rs         # Logic chính
│   ├── tauri.conf.json    # Cấu hình Tauri
│   └── Cargo.toml         # Dependencies Rust
├── public/                # Static assets
├── package.json           # Dependencies Node.js
└── next.config.ts         # Cấu hình Next.js
```

## 🎯 Tính năng chính

- ✅ Giao diện chat hiện đại với React 19
- ✅ Ứng dụng desktop cross-platform với Tauri
- ✅ Hot reload trong development
- ✅ TypeScript support đầy đủ
- ✅ Responsive design với Tailwind CSS
- ✅ Font optimization với Geist font family

## 🔧 Cấu hình

### Tauri Configuration
- **Window size**: 800x600 (có thể resize)
- **Dev URL**: http://localhost:3000
- **Build output**: `out/` directory

### Next.js Configuration
- **Turbopack**: Enabled cho development và build
- **App Router**: Sử dụng kiến trúc mới của Next.js 15

## 📚 Scripts có sẵn

- `npm run dev` - Chạy Next.js development server
- `npm run build` - Build ứng dụng Next.js
- `npm run start` - Chạy production server
- `npm run tauri dev` - Chạy Tauri development mode
- `npm run tauri build` - Build ứng dụng desktop

## 🤝 Đóng góp

1. Fork dự án
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

## 📄 License

Dự án này thuộc về [Tên tác giả/Tổ chức]. Xem file `LICENSE` để biết thêm chi tiết.

## 📞 Liên hệ

- Email: [your-email@example.com]
- GitHub: [your-github-username]
