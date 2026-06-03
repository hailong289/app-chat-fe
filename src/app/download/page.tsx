"use client";

import Image from "next/image";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";
import { useMemo } from "react";
import { PublicMarketingNav } from "@/components/intro/PublicMarketingNav";
import {
  getDownloadLinks,
  hasAnyDesktopDownload,
  hasAnyMobileDownload,
} from "@/libs/downloadLinks";
import { isTauriRuntime } from "@/libs/helpers";

type PlatformItem = {
  id: string;
  label: string;
  href: string | null;
  hint: string;
  icon: React.ReactNode;
  accent: string;
};

function PlatformIconWindows() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
      <path fill="currentColor" d="M3 5.5h8.2v8.2H3V5.5zm9.8 0H21v8.2h-8.2V5.5zM3 14.3h8.2V21H3v-6.7zm9.8 0H21V21h-8.2v-6.7z" />
    </svg>
  );
}

function PlatformIconApple() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
      <path
        fill="currentColor"
        d="M16.88 1.88c.96 1.14 1.6 2.72 1.42 4.3-1.36.06-2.68-.52-3.56-1.34-.9-.84-1.68-2.2-1.46-3.96 1.34-.1 2.72.58 3.6 1zm1.1 3.44c-2.04-.12-3.78 1.16-4.76 1.16-.98 0-2.5-1.14-4.12-1.1-2.12.04-4.08 1.24-5.18 3.16-2.22 3.84-.58 9.52 1.58 12.64 1.06 1.54 2.32 3.26 3.98 3.2 1.6-.06 2.2-1.04 4.14-1.04 1.92 0 2.46 1.04 4.12 1 1.68-.04 2.74-1.54 3.78-3.1 1.2-1.74 1.68-3.44 1.7-3.52-.04-.02-3.28-1.26-3.32-5-.04-3.14 2.54-4.64 2.66-4.72-1.44-2.12-3.68-2.4-4.48-2.44z"
      />
    </svg>
  );
}

function PlatformIconLinux() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden>
      <path
        fill="currentColor"
        d="M12.5 2c-2.8 0-5 2.2-5 5v1.2c-1.4.8-2.4 2.3-2.4 4.1 0 1.2.5 2.3 1.2 3.1-.3.9-.5 1.9-.5 2.9 0 3.5 2.5 4.5 4.2 4.7.6 1.1 1.6 1.8 2.8 1.8h1.4c1.2 0 2.2-.7 2.8-1.8 1.7-.2 4.2-1.2 4.2-4.7 0-1-.2-2-.5-2.9.7-.8 1.2-1.9 1.2-3.1 0-1.8-1-3.3-2.4-4.1V7c0-2.8-2.2-5-5-5zm-1.2 14.5c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9zm2.4 0c-.5 0-.9-.4-.9-.9s.4-.9.9-.9.9.4.9.9-.4.9-.9.9z"
      />
    </svg>
  );
}

function PlatformDownloadRow({ label, href, hint, icon, accent }: PlatformItem) {
  const available = !!href;

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-2xl border transition-all duration-200 ${
        available
          ? "border-slate-200/80 bg-slate-50/80 hover:border-primary/35 hover:shadow-md hover:shadow-primary/5 dark:border-slate-700/80 dark:bg-slate-800/40 dark:hover:border-primary/40"
          : "border-dashed border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/20"
      }`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-50">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>
        </div>
      </div>
      <Button
        color={available ? "primary" : "default"}
        variant={available ? "solid" : "bordered"}
        className="w-full sm:w-auto sm:min-w-[140px] font-semibold"
        startContent={<ArrowDownTrayIcon className="w-5 h-5" />}
        isDisabled={!available}
        onPress={() => {
          if (href) window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        {available ? "Tải xuống" : "Sắp có"}
      </Button>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 items-start text-sm text-slate-600 dark:text-slate-300">
          <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DownloadPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const links = useMemo(() => getDownloadLinks(), []);
  const inDesktopApp = useMemo(
    () => typeof window !== "undefined" && isTauriRuntime(),
    [],
  );

  const desktopPlatforms: PlatformItem[] = [
    {
      id: "win",
      label: "Windows",
      href: links.desktopWindows,
      hint: "Tauri 2 · WebView2 · .msi",
      icon: <PlatformIconWindows />,
      accent: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      id: "mac",
      label: "macOS",
      href: links.desktopMacos,
      hint: "Apple Silicon & Intel · .dmg",
      icon: <PlatformIconApple />,
      accent: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
    },
    {
      id: "linux",
      label: "Linux",
      href: links.desktopLinux,
      hint: "Debian / Ubuntu · .deb",
      icon: <PlatformIconLinux />,
      accent: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
  ];

  const mobilePlatforms: PlatformItem[] = [
    {
      id: "android",
      label: "Google Play",
      href: links.androidStore,
      hint: "Android 8+ · React Native",
      icon: <DevicePhoneMobileIcon className="w-6 h-6" />,
      accent: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      id: "ios",
      label: "App Store",
      href: links.iosStore,
      hint: "iOS 15+ · React Native",
      icon: <DevicePhoneMobileIcon className="w-6 h-6" />,
      accent: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    },
  ];

  const desktopReady = hasAnyDesktopDownload(links);
  const mobileReady = hasAnyMobileDownload(links);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute top-1/3 left-0 h-64 w-64 rounded-full bg-secondary/10 blur-3xl" />
      </div>

      <PublicMarketingNav />

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14 space-y-12">
        <section className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/25 rounded-3xl blur-2xl scale-110" />
              <Image
                src="/logo.png"
                alt="IChat"
                width={88}
                height={88}
                className="relative z-10 drop-shadow-lg rounded-2xl ring-4 ring-white/80 dark:ring-slate-800/80"
              />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 bg-linear-to-r from-primary-600 via-sky-500 to-teal-500 bg-clip-text text-transparent dark:from-primary-400 dark:via-sky-400 dark:to-teal-400">
            Tải IChat trên mọi thiết bị
          </h1>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            Cùng tài khoản trên web, desktop (Tauri) và mobile — chat, tài liệu,
            todo và AI trong một nền tảng.
          </p>
          <div className="flex justify-center gap-2 flex-wrap mt-6">
            <Chip size="sm" color="primary" variant="flat">
              Web
            </Chip>
            <Chip size="sm" color="secondary" variant="flat">
              Desktop
            </Chip>
            <Chip size="sm" color="success" variant="flat">
              Mobile
            </Chip>
          </div>
        </section>

        {inDesktopApp && (
          <Card className="border border-primary/30 bg-primary/5 shadow-none dark:bg-primary/10">
            <CardBody className="py-4 text-center text-sm text-slate-700 dark:text-slate-200">
              Bạn đang dùng bản desktop. Tải bản mới tại mục bên dưới khi có phát
              hành trên GitHub Releases.
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-6 lg:gap-8">
          <Card className="border-0 shadow-lg shadow-slate-200/60 dark:shadow-none bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-linear-to-r from-primary-500 via-sky-500 to-teal-500" />
            <CardBody className="p-6 md:p-8 gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-primary/10 text-primary-600 dark:text-primary-300">
                    <ComputerDesktopIcon className="w-9 h-9" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Ứng dụng Desktop
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Windows · macOS · Linux — Tauri bọc giao diện web
                    </p>
                  </div>
                </div>
                {!desktopReady && (
                  <Chip size="sm" variant="flat" color="warning">
                    Chưa cấu hình link tải
                  </Chip>
                )}
              </div>

              <FeatureList
                items={[
                  "Thông báo hệ thống & mở cài đặt Windows",
                  "Cửa sổ riêng cho cuộc gọi / tài liệu",
                  "Đầy đủ tính năng web: chat, docs, todo, AI",
                ]}
              />

              <div className="space-y-3">
                {desktopPlatforms.map((p) => (
                  <PlatformDownloadRow key={p.id} {...p} />
                ))}
              </div>
            </CardBody>
          </Card>

          <Card className="border-0 shadow-lg shadow-slate-200/60 dark:shadow-none bg-white/90 dark:bg-slate-900/80 backdrop-blur-sm overflow-hidden">
            <div className="h-1.5 bg-linear-to-r from-violet-500 via-fuchsia-500 to-pink-500" />
            <CardBody className="p-6 md:p-8 gap-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 rounded-2xl bg-secondary/10 text-secondary-600 dark:text-secondary-300">
                    <DevicePhoneMobileIcon className="w-9 h-9" />
                  </div>
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-50">
                      Ứng dụng Mobile
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      iOS & Android — React Native, SQLite offline
                    </p>
                  </div>
                </div>
                {!mobileReady && (
                  <Chip size="sm" variant="flat" color="warning">
                    Chưa cấu hình cửa hàng
                  </Chip>
                )}
              </div>

              <FeatureList
                items={[
                  "Chat realtime, danh bạ, cuộc gọi P2P & SFU",
                  "Cache tin nhắn offline (nitro-sqlite)",
                  "Push notification qua Firebase FCM",
                ]}
              />

              <div className="space-y-3">
                {mobilePlatforms.map((p) => (
                  <PlatformDownloadRow key={p.id} {...p} />
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <Card className="border-0 shadow-md bg-linear-to-br from-white via-slate-50 to-primary-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-primary-950/40">
          <CardBody className="py-8 px-6 md:px-10 flex flex-col gap-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-center sm:text-left w-full">
              <div className="mx-auto sm:mx-0 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary-500">
                <GlobeAltIcon className="w-8 h-8" />
              </div>
              <div className="w-full sm:flex-1">
                <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-50 mb-1">
                  {isAuthenticated ? "Tiếp tục trên web" : "Dùng ngay trên trình duyệt"}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mx-auto sm:mx-0">
                  {isAuthenticated
                    ? "Bạn đã đăng nhập — mở chat hoặc quay lại trang giới thiệu."
                    : "Không cần cài đặt — đăng ký và trải nghiệm đầy đủ trên web."}
                </p>
              </div>
            </div>
            <div
              className={`grid w-full gap-3 ${
                isAuthenticated
                  ? "grid-cols-1 sm:grid-cols-2 max-w-md sm:max-w-lg mx-auto sm:mx-0 sm:ml-auto"
                  : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-lg md:max-w-2xl mx-auto sm:mx-0 sm:ml-auto"
              }`}
            >
              {isAuthenticated ? (
                <Button
                  color="primary"
                  size="lg"
                  className="w-full font-semibold"
                  startContent={<ChatBubbleLeftRightIcon className="w-5 h-5" />}
                  onPress={() => router.push("/chat")}
                >
                  Vào chat
                </Button>
              ) : (
                <>
                  <Button
                    color="primary"
                    size="lg"
                    className="w-full font-semibold"
                    onPress={() => router.push("/auth/register")}
                  >
                    Đăng ký miễn phí
                  </Button>
                  <Button
                    variant="bordered"
                    size="lg"
                    className="w-full"
                    onPress={() => router.push("/auth")}
                  >
                    Đăng nhập
                  </Button>
                </>
              )}
              <Button
                variant="flat"
                size="lg"
                className={`w-full text-slate-700 dark:text-slate-200 ${
                  isAuthenticated ? "" : "sm:col-span-2 md:col-span-1"
                }`}
                startContent={<ArrowLeftIcon className="w-5 h-5" />}
                onPress={() => router.push("/dashboard")}
              >
                Giới thiệu
              </Button>
            </div>
          </CardBody>
        </Card>

        <footer className="text-center pb-6 text-slate-500 dark:text-slate-500 text-sm">
          <p>IChat — Đề tài tốt nghiệp UIT · Web / Desktop / Mobile</p>
        </footer>
      </div>
    </div>
  );
}
