"use client";

import Image from "next/image";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  BellIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
  AcademicCapIcon,
  LanguageIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  MicrophoneIcon,
  CameraIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { useEffect, useMemo } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  // Redirect nếu đã login
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: "Chat Realtime",
      description:
        "Trò chuyện nhóm với Socket.IO, hỗ trợ 1000+ kết nối đồng thời, độ trễ < 1s",
      color: "primary",
    },
    {
      icon: DocumentTextIcon,
      title: "Docs - Tài liệu",
      description:
        "Wiki/Markdown tích hợp, chia sẻ tài liệu học tập, ghi chú cộng tác nhóm",
      color: "secondary",
    },
    {
      icon: ClipboardDocumentListIcon,
      title: "ToDoList - Quản lý công việc",
      description:
        "Quản lý bài tập, deadline, phân công nhiệm vụ cho nhóm học tập",
      color: "success",
    },
    {
      icon: SparklesIcon,
      title: "AI Thông minh",
      description:
        "Tóm tắt hội thoại, gợi ý trả lời, kiểm duyệt nội dung tự động",
      color: "warning",
    },
    {
      icon: AcademicCapIcon,
      title: "Hỗ trợ học tập",
      description:
        "Flashcards tự động, Quiz AI, ghi chú thông minh từ cuộc trò chuyện",
      color: "danger",
    },
    {
      icon: MagnifyingGlassIcon,
      title: "Tìm kiếm ngữ nghĩa",
      description:
        "Tìm kiếm thông minh với AI, hiểu ngữ cảnh và ý nghĩa câu hỏi",
      color: "default",
    },
    {
      icon: LanguageIcon,
      title: "Dịch tự động",
      description:
        "Dịch tin nhắn realtime, hỗ trợ đa ngôn ngữ cho cộng tác quốc tế",
      color: "primary",
    },
    {
      icon: MicrophoneIcon,
      title: "Speech-to-Text",
      description:
        "Nhận diện giọng nói thành văn bản, ghi chú bài giảng tự động",
      color: "secondary",
    },
    {
      icon: CameraIcon,
      title: "OCR - Nhận dạng ảnh",
      description:
        "Chụp ảnh bảng, slide và chuyển thành văn bản có thể chỉnh sửa",
      color: "success",
    },
  ];

  const testimonials = [
    {
      name: "Nguyễn Thị Hoa",
      role: "Sinh viên CNTT - ĐH Bách Khoa",
      content:
        "App giúp nhóm em quản lý bài tập tốt hơn. Flashcards AI rất hữu ích cho việc ôn thi!",
      avatar: "👩‍🎓",
    },
    {
      name: "Trần Văn Nam",
      role: "Giảng viên - ĐH Khoa học Tự nhiên",
      content:
        "Tính năng tóm tắt hội thoại giúp tôi nắm bắt nhanh câu hỏi của sinh viên. Rất tiện lợi!",
      avatar: "👨‍🏫",
    },
    {
      name: "Lê Minh Tuấn",
      role: "Team Lead - Startup EdTech",
      content:
        "Docs + ToDoList + Chat trong một nền tảng giúp team phối hợp hiệu quả hơn 30%.",
      avatar: "👨‍💼",
    },
  ];

  const aiFeatures = [
    {
      icon: LightBulbIcon,
      title: "Gợi ý trả lời thông minh",
      description: "AI đề xuất câu trả lời dựa trên ngữ cảnh cuộc trò chuyện",
    },
    {
      icon: DocumentTextIcon,
      title: "Tóm tắt hội thoại",
      description:
        "Tự động tóm tắt các cuộc thảo luận dài thành những điểm chính",
    },
    {
      icon: AcademicCapIcon,
      title: "Flashcards & Quiz",
      description: "Tạo thẻ ghi nhớ và bài kiểm tra từ nội dung học tập",
    },
    {
      icon: ShieldCheckIcon,
      title: "Kiểm duyệt nội dung",
      description: "Phát hiện và lọc nội dung không phù hợp tự động",
    },
  ];

  const featureColorStyles = useMemo(
    () =>
      ({
        primary:
          "bg-primary/10 text-primary-700 dark:text-primary-300 dark:bg-primary/15",
        secondary:
          "bg-secondary/10 text-secondary-700 dark:text-secondary-300 dark:bg-secondary/15",
        success:
          "bg-success/10 text-success-700 dark:text-success-300 dark:bg-success/15",
        warning:
          "bg-warning/10 text-warning-700 dark:text-warning-300 dark:bg-warning/15",
        danger:
          "bg-danger/10 text-danger-700 dark:text-danger-300 dark:bg-danger/15",
        default:
          "bg-slate-100 text-slate-700 dark:bg-default/15 dark:text-default-300",
      } as Record<string, string>),
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-slate-200 dark:bg-slate-900/90 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-xl font-bold text-slate-900 dark:text-slate-50">
              EduChat <span className="text-primary-500">·</span>{" "}
              <span className="text-slate-500 dark:text-slate-300">
                Học tập thông minh
              </span>
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              variant="bordered"
              className="border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onPress={() => router.push("/auth")}
            >
              Đăng nhập
            </Button>
            <Button
              color="primary"
              endContent={<ArrowRightIcon className="w-4 h-4" />}
              onPress={() => router.push("/auth/register")}
            >
              Đăng ký ngay
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-16">
        {/* Header Section */}
        <section className="text-center">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl dark:bg-primary/30" />
              <Image
                src="/logo.png"
                alt="Chat App Logo"
                width={120}
                height={120}
                className="relative z-10 drop-shadow-2xl rounded-3xl"
              />
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-primary-500 via-sky-500 to-secondary-500 bg-clip-text text-transparent">
            Học tập và cộng tác với AI
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
            Nền tảng chat đa nền tảng tích hợp AI, Docs và ToDoList — thiết kế
            cho sinh viên, nhóm học tập và giảng viên trên kiến trúc
            Microservices hiện đại.
          </p>

          {/* Stats Banner */}
          <div className="flex justify-center gap-8 mb-10 flex-wrap">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-500">1000+</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Kết nối đồng thời
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary-500">
                &lt; 1s
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Độ trễ tin nhắn
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-500">8+ AI</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Tính năng AI
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500">99.9%</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Uptime hệ thống
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              color="primary"
              size="lg"
              className="font-semibold"
              startContent={<RocketLaunchIcon className="w-5 h-5" />}
              onPress={() => router.push("/auth/register")}
            >
              Bắt đầu miễn phí
            </Button>
            <Button
              variant="bordered"
              size="lg"
              className="font-semibold border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              onPress={() => {
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Tìm hiểu thêm
            </Button>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
              Tính năng toàn diện
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Chat · Docs · Tasks · AI — tất cả trong một nền tảng duy nhất cho
              học tập và cộng tác.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border border-slate-200 bg-white shadow-sm hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10 transition-all dark:border-slate-800 dark:bg-slate-900/70"
                shadow="none"
              >
                <CardHeader className="flex gap-3">
                  <div
                    className={`p-3 rounded-lg ${
                      featureColorStyles[feature.color] ||
                      featureColorStyles.default
                    }`}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {feature.title}
                    </p>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-slate-600 dark:text-slate-300 text-sm">
                    {feature.description}
                  </p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* AI Features Section */}
        <section>
          <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 border border-purple-200 dark:from-purple-900/40 dark:via-pink-900/30 dark:to-blue-900/40 dark:border-purple-700/40">
            <CardHeader className="flex flex-col items-center pb-0 pt-8">
              <SparklesIcon className="w-12 h-12 text-purple-500 dark:text-purple-300 mb-4" />
              <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-50">
                Trí tuệ nhân tạo hỗ trợ học tập
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl">
                Hơn 8 tính năng AI giúp tối ưu hóa quá trình học tập và cộng tác
                cho cả sinh viên và giảng viên.
              </p>
            </CardHeader>
            <CardBody className="pt-8 pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {aiFeatures.map((feature, index) => (
                  <div key={index} className="text-center">
                    <div className="flex justify-center mb-3">
                      <div className="p-4 rounded-full bg-white shadow-sm border border-purple-100 dark:bg-slate-900/70 dark:border-purple-500/40">
                        <feature.icon className="w-8 h-8 text-purple-500 dark:text-purple-300" />
                      </div>
                    </div>
                    <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Testimonials */}
        <section className="space-y-6">
          <div className="text-center space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-50">
              Đánh giá từ cộng đồng
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Sinh viên, giảng viên và các nhóm học tập đang sử dụng EduChat mỗi
              ngày.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
                shadow="none"
              >
                <CardBody>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{testimonial.avatar}</div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm italic">
                      &quot;{testimonial.content}&quot;
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-slate-50">
            Dành cho ai?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-100 dark:from-blue-900/60 dark:to-cyan-900/60 dark:border-blue-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🎓</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Sinh viên & Nhóm học tập
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Chat nhóm, chia sẻ tài liệu học tập</li>
                  <li>✅ Tóm tắt bài giảng bằng AI</li>
                  <li>✅ Quản lý deadline bài tập</li>
                  <li>✅ Ôn thi với Flashcards & Quiz</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 dark:from-green-900/60 dark:to-emerald-900/60 dark:border-emerald-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🏫</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Giảng viên
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Tương tác với sinh viên realtime</li>
                  <li>✅ Chia sẻ tài liệu giảng dạy</li>
                  <li>✅ Tạo Quiz kiểm tra nhanh</li>
                  <li>✅ Theo dõi tiến độ nhóm học</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 dark:from-purple-900/60 dark:to-pink-900/60 dark:border-purple-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍💼</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Doanh nghiệp nhỏ
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Quản lý dự án với Tasks</li>
                  <li>✅ Lưu trữ tài liệu với Docs</li>
                  <li>✅ Cộng tác nhóm hiệu quả</li>
                  <li>✅ Dịch đa ngôn ngữ tự động</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* Tech Stack Section */}
        <section>
          <Card className="bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 dark:from-slate-900 dark:to-slate-950 dark:border-slate-700/60">
            <CardHeader className="flex flex-col items-center pb-0 pt-8">
              <ShieldCheckIcon className="w-12 h-12 text-primary-500 dark:text-primary-300 mb-4" />
              <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-50">
                Kiến trúc Microservices hiện đại
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl">
                Xây dựng trên nền tảng Node.js / NestJS, tối ưu cho realtime, mở
                rộng ngang với Kafka & Docker.
              </p>
            </CardHeader>
            <CardBody className="pt-8 pb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
                {[
                  { name: "Node.js", color: "success" },
                  { name: "NestJS", color: "danger" },
                  { name: "MongoDB", color: "success" },
                  { name: "Redis", color: "danger" },
                  { name: "Socket.IO", color: "primary" },
                  { name: "Kafka", color: "warning" },
                  { name: "Docker", color: "primary" },
                  { name: "Next.js 15", color: "default" },
                  { name: "React Native", color: "primary" },
                  { name: "OpenAI API", color: "success" },
                  { name: "Google AI", color: "warning" },
                  { name: "Hugging Face", color: "secondary" },
                  { name: "Firebase", color: "danger" },
                  { name: "TypeScript", color: "primary" },
                  { name: "Tailwind v4", color: "secondary" },
                ].map((tech, index) => (
                  <Chip
                    key={index}
                    color={tech.color as any}
                    variant="flat"
                    className="w-full justify-center py-4 font-semibold bg-white text-slate-800 border border-slate-200 dark:bg-slate-900/70 dark:text-slate-100 dark:border-slate-700/60"
                  >
                    {tech.name}
                  </Chip>
                ))}
              </div>

              {/* Architecture Highlight */}
              <div className="mt-8 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-primary-500 dark:text-primary-300 mb-1">
                      8+
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Microservices độc lập
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      User, Message, Docs, Tasks, AI...
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-secondary-500 dark:text-secondary-300 mb-1">
                      1000+
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Concurrent connections
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Horizontal scaling với Kafka
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-300 mb-1">
                      &lt; 1s
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Message latency trung bình
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Realtime với Socket.IO
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Final CTA */}
        <section>
          <Card className="bg-gradient-to-r from-primary-600 to-secondary-600 border-none">
            <CardBody className="py-10 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Bắt đầu học tập thông minh hơn
              </h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto text-sm md:text-base">
                Tham gia EduChat — Nền tảng chat tích hợp AI được thiết kế riêng
                cho sinh viên, nhóm học tập và giảng viên.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button
                  size="lg"
                  className="bg-white text-primary-700 font-semibold"
                  startContent={<RocketLaunchIcon className="w-5 h-5" />}
                  onPress={() => router.push("/auth/register")}
                >
                  Đăng ký miễn phí
                </Button>
                <Button
                  size="lg"
                  variant="bordered"
                  className="border-white text-white font-semibold hover:bg-white/10"
                  startContent={<AcademicCapIcon className="w-5 h-5" />}
                  onPress={() => router.push("/auth")}
                >
                  Dùng thử ngay
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center pt-4 pb-8 text-slate-500 dark:text-slate-500 text-sm space-y-1">
          <p>🎓 EduChat — Nền tảng học tập thông minh với AI</p>
          <p>
            Kiến trúc Microservices · 1000+ Concurrent Users · &lt;1s Latency ·
            8+ AI Features
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            © 2025 EduChat. Đề tài nghiên cứu ứng dụng chat đa nền tảng tích hợp
            AI phục vụ học tập.
          </p>
        </footer>
      </div>
    </div>
  );
}
