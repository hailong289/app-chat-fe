"use client";

import Image from "next/image";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  SparklesIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  LanguageIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  PhoneIcon,
  DocumentMagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { useEffect, useMemo } from "react";
import { PublicMarketingNav } from "@/components/intro/PublicMarketingNav";

/**
 * Public landing page. Shown to logged-out visitors at "/" (via redirect
 * in client-layout) and at "/dashboard" directly.
 *
 * Content rule: every claim on this page must map to something that
 * actually exists in the codebase.
 *   - Feature cards mirror the real FE routes (chat, docs, todo,
 *     flash-card, call) and the BE AI gRPC endpoints (8 methods on
 *     AIService — see apps/ai/src/ai.controller.ts).
 *   - Stats reflect verifiable architectural facts (microservice count,
 *     AI endpoint count) rather than aspirational performance numbers.
 *   - Tech stack lists deps actually wired up in code; OCR /
 *     speech-to-text / fake testimonials were removed because there
 *     was no implementation behind them.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: "Chat realtime",
      description:
        "Chat 1-1, nhóm, kênh. Pin / recall / reply / reaction. Đồng bộ qua Socket.IO + Kafka cho scale ngang.",
      color: "primary",
    },
    {
      icon: DocumentTextIcon,
      title: "Docs cộng tác",
      description:
        "Soạn tài liệu rich-text (BlockNote) đồng thời nhiều người qua Yjs. Comment inline + thread + reaction.",
      color: "secondary",
    },
    {
      icon: ClipboardDocumentListIcon,
      title: "Todo & Kanban",
      description:
        "Quản lý dự án, board kanban kéo-thả, gán việc, deadline, chia sẻ vào phòng chat.",
      color: "success",
    },
    {
      icon: PhoneIcon,
      title: "Voice / Video call",
      description:
        "Cuộc gọi 1-1 và nhóm dựa trên Mediasoup SFU. Push notify khi có cuộc gọi đến qua FCM.",
      color: "warning",
    },
    {
      icon: AcademicCapIcon,
      title: "Flashcards & Quiz",
      description:
        "Tạo bộ thẻ ghi nhớ và bài quiz tự động từ AI hoặc nhập tay. Phục vụ ôn tập, kiểm tra nhanh.",
      color: "danger",
    },
    {
      icon: SparklesIcon,
      title: "Gợi ý trả lời",
      description:
        "AI suggest reply theo ngữ cảnh cuộc trò chuyện, kèm emoji & GIF keyword đề xuất.",
      color: "primary",
    },
    {
      icon: LanguageIcon,
      title: "Dịch tin nhắn",
      description:
        "Dịch tin nhắn sang ngôn ngữ hiển thị hiện tại (vi/en) qua AIService.Translation.",
      color: "secondary",
    },
    {
      icon: MagnifyingGlassIcon,
      title: "Tìm kiếm ngữ nghĩa",
      description:
        "Embedding tin nhắn / tài liệu / file. Tìm theo ý nghĩa thay vì khớp từ khoá.",
      color: "default",
    },
    {
      icon: DocumentMagnifyingGlassIcon,
      title: "Tóm tắt tài liệu",
      description:
        "AI tóm tắt nội dung doc dài thành các điểm chính, hỗ trợ ôn nhanh và onboarding.",
      color: "success",
    },
  ];

  const aiFeatures = [
    {
      icon: LightBulbIcon,
      title: "SuggestReplies",
      description:
        "Đề xuất 3 câu trả lời + emoji + GIF keyword theo ngữ cảnh.",
    },
    {
      icon: DocumentTextIcon,
      title: "SummaryDocument",
      description: "Tóm tắt nội dung tài liệu thành các điểm chính.",
    },
    {
      icon: AcademicCapIcon,
      title: "Quizz / GenerateFlashcard",
      description: "Sinh quiz và bộ thẻ flashcard từ tài liệu / tin nhắn.",
    },
    {
      icon: ShieldCheckIcon,
      title: "Moderation",
      description: "Kiểm duyệt tin nhắn để lọc nội dung độc hại tự động.",
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
      <PublicMarketingNav />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-16">
        {/* Hero */}
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

          <h1 className="text-4xl md:text-6xl font-extrabold mb-4 bg-linear-to-r from-primary-500 via-sky-500 to-secondary-500 bg-clip-text text-transparent">
            Học tập và cộng tác với AI
          </h1>

          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 mb-8 max-w-3xl mx-auto">
            Nền tảng tích hợp Chat, Docs cộng tác, Todo, Voice/Video call và
            các tính năng AI — xây dựng trên kiến trúc microservices NestJS.
          </p>

          {/* Architectural facts (verifiable, not aspirational). */}
          <div className="flex justify-center gap-8 mb-10 flex-wrap">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-500">9</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Microservices
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-secondary-500">8</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                AI endpoints
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-500">5</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Module sản phẩm
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-500">2</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Ngôn ngữ (vi / en)
              </div>
            </div>
          </div>

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
              onPress={() => router.push("/download")}
            >
              Tải ứng dụng
            </Button>
            <Button
              variant="light"
              size="lg"
              className="font-semibold text-slate-700 dark:text-slate-200"
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
              Tính năng đã triển khai
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Mỗi card tương ứng một module có route / API thật trong hệ
              thống.
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
          <Card className="bg-linear-to-br from-purple-50 via-pink-50 to-blue-50 border border-purple-200 dark:from-purple-900/40 dark:via-pink-900/30 dark:to-blue-900/40 dark:border-purple-700/40">
            <CardHeader className="flex flex-col items-center pb-0 pt-8">
              <SparklesIcon className="w-12 h-12 text-purple-500 dark:text-purple-300 mb-4" />
              <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-50">
                AI service — 8 endpoints
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl">
                Service AI riêng biệt giao tiếp qua gRPC + Kafka. Dùng Google
                Generative AI cho LLM, embedding cho semantic search.
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
              <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-6">
                Endpoint khác: Search / SearchMessages, Embedding cho chat &
                doc, file processing.
              </p>
            </CardBody>
          </Card>
        </section>

        {/* Use Cases */}
        <section className="space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-slate-50">
            Dành cho ai?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Card className="bg-linear-to-br from-blue-50 to-cyan-50 border border-blue-100 dark:from-blue-900/60 dark:to-cyan-900/60 dark:border-blue-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🎓</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Sinh viên & Nhóm học tập
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Chat nhóm, chia sẻ tài liệu</li>
                  <li>✅ Tóm tắt tài liệu bằng AI</li>
                  <li>✅ Quản lý deadline trên kanban</li>
                  <li>✅ Ôn thi với Flashcards & Quiz</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-linear-to-br from-emerald-50 to-teal-50 border border-emerald-100 dark:from-green-900/60 dark:to-emerald-900/60 dark:border-emerald-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍🏫</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Giảng viên
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Voice / Video call với lớp</li>
                  <li>✅ Soạn tài liệu cộng tác (Docs)</li>
                  <li>✅ Tạo Quiz nhanh từ AI</li>
                  <li>✅ Theo dõi tiến độ qua Todo</li>
                </ul>
              </CardBody>
            </Card>

            <Card className="bg-linear-to-br from-purple-50 to-pink-50 border border-purple-100 dark:from-purple-900/60 dark:to-pink-900/60 dark:border-purple-700/40">
              <CardBody className="p-6">
                <div className="text-4xl mb-4">👨‍💼</div>
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-slate-50">
                  Team nhỏ
                </h3>
                <ul className="text-sm text-slate-700 dark:text-slate-200 space-y-2">
                  <li>✅ Kanban quản lý dự án</li>
                  <li>✅ Doc cộng tác có comment</li>
                  <li>✅ Họp video qua SFU</li>
                  <li>✅ Tìm kiếm ngữ nghĩa</li>
                </ul>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <Card className="bg-linear-to-br from-slate-100 to-slate-50 border border-slate-200 dark:from-slate-900 dark:to-slate-950 dark:border-slate-700/60">
            <CardHeader className="flex flex-col items-center pb-0 pt-8">
              <ShieldCheckIcon className="w-12 h-12 text-primary-500 dark:text-primary-300 mb-4" />
              <h2 className="text-3xl font-bold text-center mb-2 text-slate-900 dark:text-slate-50">
                Kiến trúc microservices
              </h2>
              <p className="text-slate-600 dark:text-slate-300 text-center max-w-2xl">
                9 service NestJS độc lập giao tiếp qua gRPC + Kafka, đóng gói
                bằng Docker.
              </p>
            </CardHeader>
            <CardBody className="pt-8 pb-8">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
                {[
                  { name: "Node.js", color: "success" },
                  { name: "NestJS", color: "danger" },
                  { name: "gRPC", color: "primary" },
                  { name: "Kafka", color: "warning" },
                  { name: "MongoDB", color: "success" },
                  { name: "Redis", color: "danger" },
                  { name: "Socket.IO", color: "primary" },
                  { name: "Mediasoup (SFU)", color: "secondary" },
                  { name: "Docker", color: "primary" },
                  { name: "Next.js 15", color: "default" },
                  { name: "BlockNote", color: "secondary" },
                  { name: "Yjs (CRDT)", color: "warning" },
                  { name: "HeroUI", color: "primary" },
                  { name: "Tailwind", color: "secondary" },
                  { name: "TypeScript", color: "primary" },
                  { name: "Google Generative AI", color: "success" },
                  { name: "Firebase FCM", color: "danger" },
                  { name: "Zustand", color: "default" },
                  { name: "i18next", color: "primary" },
                  { name: "React 19", color: "secondary" },
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

              <div className="mt-8 max-w-4xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-primary-500 dark:text-primary-300 mb-1">
                      9
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Microservices
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      ai · auth · chat · socket · sfu · learning · notification
                      · filesystem · api-gateway
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-secondary-500 dark:text-secondary-300 mb-1">
                      gRPC + Kafka
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Giao tiếp giữa service
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      gRPC sync, Kafka event-driven async
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-slate-200 dark:bg-slate-900/80 dark:border-slate-700">
                    <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-300 mb-1">
                      Yjs
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      Realtime collab
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      CRDT cho Docs cộng tác đa người
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Final CTA */}
        <section>
          <Card className="bg-linear-to-r from-primary-600 to-secondary-600 border-none">
            <CardBody className="py-10 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Sẵn sàng dùng thử
              </h2>
              <p className="text-white/90 mb-8 max-w-xl mx-auto text-sm md:text-base">
                Đăng ký tài khoản miễn phí để khám phá toàn bộ tính năng đã
                triển khai.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button
                  size="lg"
                  className="bg-white text-primary-700 font-semibold"
                  startContent={<RocketLaunchIcon className="w-5 h-5" />}
                  onPress={() => router.push("/auth/register")}
                >
                  Đăng ký
                </Button>
                <Button
                  size="lg"
                  variant="bordered"
                  className="border-white text-white font-semibold hover:bg-white/10"
                  startContent={<AcademicCapIcon className="w-5 h-5" />}
                  onPress={() => router.push("/auth")}
                >
                  Đăng nhập
                </Button>
              </div>
            </CardBody>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center pt-4 pb-8 text-slate-500 dark:text-slate-500 text-sm space-y-1">
          <p>🎓 IChat — Đề tài tốt nghiệp UIT</p>
          <p>
            9 microservices · 8 AI endpoints · NestJS / Next.js / Yjs /
            Mediasoup
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-600">
            © 2025 IChat. Đề tài nghiên cứu nền tảng chat đa nền tảng tích
            hợp AI phục vụ học tập.
          </p>
        </footer>
      </div>
    </div>
  );
}
