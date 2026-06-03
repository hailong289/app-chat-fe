"use client";

import Image from "next/image";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { useEffect, useMemo } from "react";
import { PublicMarketingNav } from "@/components/intro/PublicMarketingNav";
import {
  getDownloadLinks,
  hasAnyDesktopDownload,
  hasAnyMobileDownload,
} from "@/libs/downloadLinks";
import { isTauriRuntime } from "@/libs/helpers";

type PlatformButton = {
  label: string;
  href: string | null;
  hint: string;
};

function DownloadPlatformButton({
  label,
  href,
  hint,
}: PlatformButton) {
  const available = !!href;

  return (
    <div className="flex flex-col gap-1">
      <Button
        color={available ? "primary" : "default"}
        variant={available ? "solid" : "bordered"}
        className="w-full font-semibold"
        startContent={<ArrowDownTrayIcon className="w-5 h-5" />}
        isDisabled={!available}
        onPress={() => {
          if (href) window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        {label}
      </Button>
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        {available ? hint : "Liên kết tải sẽ được cập nhật sớm"}
      </p>
    </div>
  );
}

export default function DownloadPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const links = useMemo(() => getDownloadLinks(), []);
  const inDesktopApp = useMemo(
    () => typeof window !== "undefined" && isTauriRuntime(),
    [],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const desktopPlatforms: PlatformButton[] = [
    {
      label: "Windows (.msi)",
      href: links.desktopWindows,
      hint: "Tauri 2 · WebView2",
    },
    {
      label: "macOS (.dmg)",
      href: links.desktopMacos,
      hint: "Apple Silicon & Intel",
    },
    {
      label: "Linux (.deb / .AppImage)",
      href: links.desktopLinux,
      hint: "Bản build Tauri",
    },
  ];

  const mobilePlatforms: PlatformButton[] = [
    {
      label: "Google Play",
      href: links.androidStore,
      hint: "Android 8+",
    },
    {
      label: "App Store",
      href: links.iosStore,
      hint: "iOS 15+",
    },
  ];

  const desktopReady = hasAnyDesktopDownload(links);
  const mobileReady = hasAnyMobileDownload(links);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <PublicMarketingNav />

      <div className="max-w-6xl mx-auto px-4 py-10 space-y-14">
        <section className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl dark:bg-primary/30" />
              <Image
                src="/logo.png"
                alt="IChat"
                width={96}
                height={96}
                className="relative z-10 drop-shadow-xl rounded-2xl"
              />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 bg-linear-to-r from-primary-500 via-sky-500 to-secondary-500 bg-clip-text text-transparent">
            Tải IChat trên mọi thiết bị
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-6">
            Dùng trên trình duyệt, cài bản desktop (Tauri) hoặc app di động
            React Native — cùng tài khoản, cùng phòng chat và thông báo đẩy.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Chip color="primary" variant="flat">
              Web · Next.js 15
            </Chip>
            <Chip color="secondary" variant="flat">
              Desktop · Tauri 2
            </Chip>
            <Chip color="success" variant="flat">
              Mobile · React Native
            </Chip>
          </div>
        </section>

        {inDesktopApp && (
          <Card className="border border-primary/30 bg-primary/5 dark:bg-primary/10">
            <CardBody className="py-4 text-center text-sm text-slate-700 dark:text-slate-200">
              Bạn đang dùng bản desktop. Cập nhật phiên bản mới tại mục tải bên
              dưới khi có bản phát hành.
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70 h-full">
            <CardHeader className="flex flex-col items-start gap-3 pb-0">
              <div className="flex items-center gap-3 w-full">
                <div className="p-3 rounded-xl bg-primary/10 text-primary-600 dark:text-primary-300">
                  <ComputerDesktopIcon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    Ứng dụng Desktop
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Windows, macOS, Linux — gói Tauri bọc giao diện web
                  </p>
                </div>
              </div>
              {!desktopReady && (
                <Chip size="sm" variant="flat" color="warning">
                  Chưa cấu hình link tải
                </Chip>
              )}
            </CardHeader>
            <CardBody className="space-y-6">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {[
                  "Thông báo hệ thống & mở cài đặt Windows",
                  "Cửa sổ riêng cho cuộc gọi / tài liệu",
                  "Toàn bộ tính năng web: chat, docs, todo, AI",
                ].map((item) => (
                  <li key={item} className="flex gap-2 items-start">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {desktopPlatforms.map((p) => (
                  <DownloadPlatformButton key={p.label} {...p} />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
                Tự build: chạy{" "}
                <code className="text-primary-600 dark:text-primary-400">
                  npm run build:tauri:release
                </code>{" "}
                — file cài đặt nằm trong{" "}
                <code className="text-primary-600 dark:text-primary-400">
                  src-tauri/target/release/bundle/
                </code>
                .
              </p>
            </CardBody>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70 h-full">
            <CardHeader className="flex flex-col items-start gap-3 pb-0">
              <div className="flex items-center gap-3 w-full">
                <div className="p-3 rounded-xl bg-secondary/10 text-secondary-600 dark:text-secondary-300">
                  <DevicePhoneMobileIcon className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                    Ứng dụng Mobile
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    iOS & Android — React Native, SQLite offline
                  </p>
                </div>
              </div>
              {!mobileReady && (
                <Chip size="sm" variant="flat" color="warning">
                  Chưa cấu hình cửa hàng ứng dụng
                </Chip>
              )}
            </CardHeader>
            <CardBody className="space-y-6">
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {[
                  "Chat realtime, danh bạ, cuộc gọi P2P & SFU",
                  "Cache tin nhắn offline (nitro-sqlite)",
                  "Push notification qua Firebase FCM",
                ].map((item) => (
                  <li key={item} className="flex gap-2 items-start">
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto lg:mx-0">
                {mobilePlatforms.map((p) => (
                  <DownloadPlatformButton key={p.label} {...p} />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500 border-t border-slate-200 dark:border-slate-700 pt-4">
                Mã nguồn mobile nằm tại repo{" "}
                <code className="text-primary-600 dark:text-primary-400">
                  AppChatRN/
                </code>
                . Cấu hình link Play Store / App Store qua biến môi trường{" "}
                <code className="text-primary-600 dark:text-primary-400">
                  NEXT_PUBLIC_*_STORE_URL
                </code>
                .
              </p>
            </CardBody>
          </Card>
        </div>

        <Card className="bg-linear-to-br from-slate-100 to-white border border-slate-200 dark:from-slate-900 dark:to-slate-950 dark:border-slate-700/60">
          <CardBody className="py-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-center md:text-left">
              <GlobeAltIcon className="w-12 h-12 text-primary-500 shrink-0" />
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                  Dùng ngay trên trình duyệt
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                  Không cần cài đặt — đăng ký và trải nghiệm đầy đủ trên web.
                </p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button
                color="primary"
                size="lg"
                onPress={() => router.push("/auth/register")}
              >
                Đăng ký miễn phí
              </Button>
              <Button
                variant="bordered"
                size="lg"
                startContent={<ArrowLeftIcon className="w-5 h-5" />}
                className="border-slate-300 dark:border-slate-600"
                onPress={() => router.push("/dashboard")}
              >
                Về trang giới thiệu
              </Button>
            </div>
          </CardBody>
        </Card>

        <footer className="text-center pb-8 text-slate-500 dark:text-slate-500 text-sm">
          <p>🎓 IChat — Đề tài tốt nghiệp UIT · Đa nền tảng Web / Desktop / Mobile</p>
        </footer>
      </div>
    </div>
  );
}
