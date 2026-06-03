"use client";

import Image from "next/image";
import { Button } from "@heroui/button";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { useRouter, usePathname } from "next/navigation";

type PublicMarketingNavProps = {
  showDownloadLink?: boolean;
};

export function PublicMarketingNav({
  showDownloadLink = true,
}: PublicMarketingNavProps) {
  const router = useRouter();
  const path = usePathname();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-white/80 border-b border-slate-200 dark:bg-slate-900/90 dark:border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center gap-4">
        <button
          type="button"
          className="flex items-center gap-2 text-left"
          onClick={() => router.push("/dashboard")}
        >
          <Image src="/logo.png" alt="Logo" width={40} height={40} />
          <span className="text-xl font-bold text-slate-900 dark:text-slate-50">
            EduChat <span className="text-primary-500">·</span>{" "}
            <span className="text-slate-500 dark:text-slate-300 hidden sm:inline">
              Học tập thông minh
            </span>
          </span>
        </button>
        <div className="flex gap-2 sm:gap-3 flex-wrap justify-end">
          {showDownloadLink && path !== "/download" && (
            <Button
              variant="light"
              className="text-slate-700 dark:text-slate-200"
              onPress={() => router.push("/download")}
            >
              Tải ứng dụng
            </Button>
          )}
          {path !== "/dashboard" && (
            <Button
              variant="light"
              className="text-slate-700 dark:text-slate-200 hidden sm:flex"
              onPress={() => router.push("/dashboard")}
            >
              Giới thiệu
            </Button>
          )}
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
            Đăng ký
          </Button>
        </div>
      </div>
    </nav>
  );
}
