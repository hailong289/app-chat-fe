// app/page.tsx – Rewrite of the provided static HTML using Next.js App Router + HeroUI
// Assumes you already set up Tailwind v4 and wrapped the app with <HeroUIProvider /> in app/providers.tsx
"use client";
import Image from "next/image";
import Link from "next/link";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
} from "@heroui/react";
import { useCounterStore } from "@/store/useCounterStore";

// Note: Metadata cannot be exported from client components
// It should be defined in layout.tsx or a parent server component

export default function Page() {
  const { count, increase, decrease } = useCounterStore();
  return (
    <div className="bg-content text-foreground">
      <Header />

      <Button onPress={increase}>Increase</Button>
      <Button onPress={decrease}>Decrease</Button>
      <div>Count: {count}</div> 

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Hero />
        <Features />
        <About />
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <Navbar maxWidth="2xl" className="bg-background/70 backdrop-blur border-b border-divider">
      <NavbarBrand>
        <Link href="/" className="flex items-center gap-2">
          <div className="size-9 grid place-items-center rounded-md bg-foreground text-background font-bold">C</div>
          <span className="font-semibold bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">ChatApp</span>
        </Link>
      </NavbarBrand>
      <NavbarContent justify="end" className="hidden sm:flex">
        <NavbarItem>
          <Link href="#features" className="text-foreground-600 hover:text-primary">Tính năng</Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="#about" className="text-foreground-600 hover:text-primary">Giới thiệu</Link>
        </NavbarItem>
        <NavbarItem>
          <Link href="#contact" className="text-foreground-600 hover:text-primary">Liên hệ</Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <Button as={Link} href="/auth" color="primary" size="sm">Trải nghiệm ngay</Button>
      </NavbarContent>
    </Navbar>
  );
}

function Hero() {
  return (
    <section className="text-center py-16 sm:py-24">
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-4">
        Ứng dụng chat đa nền tảng <br />
        <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
          cho kỷ nguyên học tập & cộng tác
        </span>
      </h1>
      <p className="text-lg sm:text-xl text-foreground-600 max-w-3xl mx-auto mb-8">
        Hơn cả một ứng dụng nhắn tin, ChatApp là công cụ mạnh mẽ tích hợp AI và các tính năng quản lý công việc, tài liệu để tối ưu hóa hiệu suất làm việc nhóm.
      </p>
      <div className="flex flex-col sm:flex-row justify-center gap-4">
        <Button as={Link} href="/auth" color="primary" size="lg" className="shadow-lg">
          Trải nghiệm ngay
        </Button>
        <Button as={Link} href="#features" variant="bordered" size="lg">
          Xem các tính năng
        </Button>
      </div>
      <div className="mt-12">
        <div className="relative w-full aspect-[2/1] rounded-2xl overflow-hidden border border-divider shadow-2xl">
          <Image
            src="https://placehold.co/1200x600/e0e0e0/ffffff?text=App+Interface"
            alt="Giao diện ứng dụng trên nhiều thiết bị"
            fill
            className="object-cover"
            priority
            unoptimized
          />
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      title: "AI Thông Minh",
      desc: "Kiểm duyệt nội dung, tóm tắt hội thoại, dịch tự động và tìm kiếm ngữ nghĩa giúp bạn làm việc thông minh hơn.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v13m-2.585 3.585c-.99-.99-.99-2.585 0-3.585L12 12l2.585 2.585c.99.99.99 2.585 0 3.585L12 21l-2.585-2.585z" />
        </svg>
      ),
    },
    {
      title: "Tài Liệu Chung (Docs)",
      desc: "Cộng tác trực tiếp trên các tài liệu dạng wiki/markdown ngay trong ứng dụng chat của bạn.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2-8a4 4 0 00-4-4H5a4 4 0 00-4 4v12a4 4 0 004 4h10a4 4 0 004-4V8a4 4 0 00-4-4z" />
        </svg>
      ),
    },
    {
      title: "Quản Lý Công Việc",
      desc: "Tạo ToDoList, checklist và quản lý deadline dễ dàng để không bỏ lỡ bất kỳ nhiệm vụ nào.",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M15 12h.01" />
        </svg>
      ),
    },
  ];

  return (
    <section id="features" className="py-16 sm:py-24">
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12">
        Tính năng đột phá – Nâng tầm hiệu suất
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((f, i) => (
          <Card key={i} className="h-full">
            <CardHeader className="flex-row items-center gap-4">
              <div className="text-primary">{f.icon}</div>
              <div className="font-semibold">{f.title}</div>
            </CardHeader>
            <CardBody className="pt-0 text-foreground-600">{f.desc}</CardBody>
          </Card>
        ))}
      </div>
    </section>
  );
}

function About() {
  const list = [
    "Tính linh hoạt và khả năng mở rộng cao",
    "Bảo mật dữ liệu tuyệt đối",
    "Đồng bộ hóa tin nhắn theo thời gian thực",
  ];

  return (
    <section id="about" className="py-16 sm:py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="order-2 lg:order-1">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Được xây dựng với kiến trúc Microservices</h2>
          <p className="text-foreground-600 text-lg leading-relaxed mb-6">
            Ứng dụng của chúng tôi được phát triển trên kiến trúc microservices mạnh mẽ, đảm bảo tính ổn định, bảo mật và khả năng mở rộng vượt trội. Mỗi tính năng là một service độc lập, giúp hệ thống hoạt động mượt mà ngay cả khi có hàng triệu người dùng.
          </p>
          <ul className="space-y-3 text-foreground-600">
            {list.map((t, i) => (
              <li key={i} className="flex items-center">
                <span className="mr-2">✅</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 lg:order-2">
          <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden border border-divider shadow-2xl">
            <Image
              src="https://placehold.co/600x400/e0e0e0/ffffff?text=System+Architecture"
              alt="Kiến trúc hệ thống"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="bg-foreground text-background py-12 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h3 className="text-2xl font-bold mb-2">Bạn đã sẵn sàng để nâng tầm hiệu suất chưa?</h3>
        <p className="mb-6 opacity-80">Hãy liên hệ với chúng tôi để biết thêm chi tiết về sản phẩm.</p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button as={Link} href="mailto:contact@chatapp.com" color="secondary" size="md">
            Liên hệ ngay
          </Button>
          <Button as={Link} href="#" variant="bordered" size="md" className="bg-background text-foreground">
            Tìm hiểu thêm
          </Button>
        </div>
        <div className="mt-6">
          <Chip variant="flat" color="default">© {new Date().getFullYear()} ChatApp</Chip>
        </div>
      </div>
    </footer>
  );
}
