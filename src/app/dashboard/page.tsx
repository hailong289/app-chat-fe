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
import { useEffect } from "react";

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
      avatar: "�‍🎓",
    },
    {
      name: "Trần Văn Nam",
      role: "Giảng viên - ĐH Khoa học Tự nhiên",
      content:
        "Tính năng tóm tắt hội thoại giúp tôi nắm bắt nhanh câu hỏi của sinh viên. Rất tiện lợi!",
      avatar: "�‍🏫",
    },
    {
      name: "Lê Minh Tuấn",
      role: "Team Lead - Startup EdTech",
      content:
        "Docs + ToDoList + Chat trong một nền tảng giúp team phối hợp hiệu quả hơn 30%!",
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-secondary-50 to-success-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 backdrop-blur-lg bg-background/80 border-b border-default-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-xl font-bold">
              EduChat - Học tập thông minh
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="flat" onPress={() => router.push("/auth")}>
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

      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
              <Image
                src="/logo.png"
                alt="Chat App Logo"
                width={120}
                height={120}
                className="relative z-10 drop-shadow-2xl"
              />
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-4">
            Học tập và cộng tác với AI
          </h1>

          <p className="text-xl text-default-600 mb-8 max-w-2xl mx-auto">
            Nền tảng chat đa nền tảng tích hợp AI, Docs và ToDoList - Được thiết
            kế đặc biệt cho sinh viên, nhóm học tập và giảng viên với kiến trúc
            Microservices.
          </p>

          {/* Stats Banner */}
          <div className="flex justify-center gap-8 mb-8 flex-wrap">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">1000+</div>
              <div className="text-sm text-default-500">Kết nối đồng thời</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary">&lt; 1s</div>
              <div className="text-sm text-default-500">Độ trễ tin nhắn</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-success">8+ AI</div>
              <div className="text-sm text-default-500">Tính năng AI</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">99.9%</div>
              <div className="text-sm text-default-500">Uptime</div>
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
              className="font-semibold"
              onPress={() => {
                document
                  .getElementById("features")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Tìm hiểu thêm
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div id="features" className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-default-800">
            Tính năng toàn diện
          </h2>
          <p className="text-center text-default-600 mb-8 max-w-2xl mx-auto">
            Chat + Docs + Tasks + AI - Tất cả trong một nền tảng duy nhất cho
            học tập và cộng tác
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-none bg-background/60 dark:bg-default-100/50 backdrop-blur-sm hover:scale-105 transition-transform"
                shadow="sm"
              >
                <CardHeader className="flex gap-3">
                  <div
                    className={`p-3 rounded-lg bg-${feature.color}/10 text-${feature.color}`}
                  >
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-lg font-bold">{feature.title}</p>
                  </div>
                </CardHeader>
                <CardBody>
                  <p className="text-default-600">{feature.description}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Features Section */}
        <Card className="bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20 border-none mb-16">
          <CardHeader className="flex flex-col items-center pb-0 pt-8">
            <SparklesIcon className="w-12 h-12 text-purple-600 mb-4" />
            <h2 className="text-3xl font-bold text-center mb-2">
              Trí tuệ nhân tạo hỗ trợ học tập
            </h2>
            <p className="text-default-600 text-center max-w-2xl">
              8+ tính năng AI giúp tối ưu hóa quá trình học tập và cộng tác
            </p>
          </CardHeader>
          <CardBody className="pt-8 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {aiFeatures.map((feature, index) => (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-4 rounded-full bg-white/80 dark:bg-gray-800/80">
                      <feature.icon className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-default-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-default-800">
            Đánh giá từ cộng đồng
          </h2>
          <p className="text-center text-default-600 mb-8 max-w-2xl mx-auto">
            Sinh viên, giảng viên và các nhóm học tập đang sử dụng EduChat
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card
                key={index}
                className="border-none bg-background/60 dark:bg-default-100/50"
                shadow="sm"
              >
                <CardBody>
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="text-4xl">{testimonial.avatar}</div>
                      <div>
                        <p className="font-bold">{testimonial.name}</p>
                        <p className="text-sm text-default-500">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                    <p className="text-default-600 italic">
                      &quot;{testimonial.content}&quot;
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>

        {/* Use Cases Section */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-default-800">
            Dành cho ai?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <Card className="bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/20 dark:to-cyan-900/20 border-none">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🎓</div>
                <h3 className="text-xl font-bold mb-2">
                  Sinh viên & Nhóm học tập
                </h3>
                <ul className="text-sm text-default-600 space-y-2">
                  <li>✅ Chat nhóm, chia sẻ tài liệu học tập</li>
                  <li>✅ Tóm tắt bài giảng bằng AI</li>
                  <li>✅ Quản lý deadline bài tập</li>
                  <li>✅ Ôn thi với Flashcards & Quiz</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 border-none">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🏫</div>
                <h3 className="text-xl font-bold mb-2">Giảng viên</h3>
                <ul className="text-sm text-default-600 space-y-2">
                  <li>✅ Tương tác với sinh viên realtime</li>
                  <li>✅ Chia sẻ tài liệu giảng dạy</li>
                  <li>✅ Tạo Quiz kiểm tra nhanh</li>
                  <li>✅ Theo dõi tiến độ nhóm học</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 border-none">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍💼</div>
                <h3 className="text-xl font-bold mb-2">Doanh nghiệp nhỏ</h3>
                <ul className="text-sm text-default-600 space-y-2">
                  <li>✅ Quản lý dự án với Tasks</li>
                  <li>✅ Lưu trữ tài liệu với Docs</li>
                  <li>✅ Cộng tác nhóm hiệu quả</li>
                  <li>✅ Dịch đa ngôn ngữ tự động</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Tech Stack Section */}
        <Card className="bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20 border-none mb-16">
          <CardHeader className="flex flex-col items-center pb-0 pt-8">
            <ShieldCheckIcon className="w-12 h-12 text-primary mb-4" />
            <h2 className="text-3xl font-bold text-center mb-2">
              Kiến trúc Microservices
            </h2>
            <p className="text-default-600 text-center max-w-2xl">
              Xây dựng trên nền tảng hiện đại, khả năng mở rộng cao
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
                  className="w-full justify-center py-5 font-semibold"
                >
                  {tech.name}
                </Chip>
              ))}
            </div>

            {/* Architecture Highlight */}
            <div className="mt-8 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary mb-1">8+</div>
                  <div className="text-sm text-default-600">Microservices</div>
                  <div className="text-xs text-default-500 mt-1">
                    User, Message, Docs, Tasks, AI...
                  </div>
                </div>
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-secondary mb-1">
                    1000+
                  </div>
                  <div className="text-sm text-default-600">
                    Concurrent Connections
                  </div>
                  <div className="text-xs text-default-500 mt-1">
                    Horizontal scaling với Kafka
                  </div>
                </div>
                <div className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                  <div className="text-2xl font-bold text-success mb-1">
                    &lt; 1s
                  </div>
                  <div className="text-sm text-default-600">
                    Message Latency
                  </div>
                  <div className="text-xs text-default-500 mt-1">
                    Realtime với Socket.IO
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Final CTA */}
        <Card className="bg-gradient-to-r from-primary-500 to-secondary-500 border-none">
          <CardBody className="py-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Bắt đầu học tập thông minh hơn
            </h2>
            <p className="text-white/90 mb-8 max-w-xl mx-auto">
              Tham gia EduChat - Nền tảng chat tích hợp AI được thiết kế đặc
              biệt cho sinh viên và nhóm học tập
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="bg-white text-primary font-semibold"
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

        {/* Footer */}
        <div className="text-center mt-12 text-default-500">
          <p className="mb-2">
            🎓 EduChat - Nền tảng học tập thông minh với AI
          </p>
          <p className="text-sm">
            Kiến trúc Microservices • 1000+ Concurrent Users • &lt;1s Latency •
            8+ AI Features
          </p>
          <p className="text-sm mt-2">
            © 2025 EduChat. Đề tài nghiên cứu ứng dụng chat đa nền tảng tích hợp
            AI phục vụ học tập.
          </p>
        </div>
      </div>
    </div>
  );
}
