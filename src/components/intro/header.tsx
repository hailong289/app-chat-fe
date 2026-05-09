"use client";

import { toast } from "@/store/useToastStore";
import useAuthStore from "@/store/useAuthStore";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "@/components/providers/SocketProvider";
import {
  Bars3BottomLeftIcon,
  BookmarkIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import {
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/solid";
import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ThemeSwitcher } from "../ui/ThemeSwitcher";
import { LanguageSwitcher } from "../ui/LanguageSwitcher";
import { NotificationDropdown } from "../notifications/NotificationDropdown";

export const Header = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();

  const { logout: handleLogout, user } = useAuthStore();
  const { isToggled, setToggleState } = useCounterStore();
  const { disconnect: disconnectSocket } = useSocket("/chat");

  const changeToggle = useCallback(() => {
    setToggleState(!isToggled);
  }, [isToggled, setToggleState]);

  // Each nav button navigates to its own route. No more `?tab=...` query —
  // active state is derived from the URL path so deep links, refresh, and
  // back navigation all stay consistent.
  const handleLink = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  // Active highlight from URL: exact match for `/`, startsWith for everything
  // else (so `/settings/chat` highlights `/settings`).
  const activeNav = useCallback(
    (path: string) => {
      const isActive =
        path === "/" ? pathname === "/" : pathname.startsWith(path);
      return isActive ? "bg-default/40 dark:bg-slate-800" : "";
    },
    [pathname],
  );

  const logout = useCallback(() => {
    // Ngắt kết nối socket trước khi logout
    disconnectSocket();

    handleLogout((error) => {
      if (error) {
        console.error("Logout error:", error);
        toast.error("Đăng xuất thất bại. Vui lòng thử lại.", "Lỗi");
        return;
      }
      toast.success("Đăng xuất thành công!", "Thành công");

      router.push("/dashboard");
    });
  }, [handleLogout, router, disconnectSocket]);

  return (
    <div>
      <nav
        className={`
          relative flex flex-col justify-between top-0 left-0
          px-1 overflow-hidden transition-all duration-300
          h-screen
          bg-primary dark:bg-slate-900
          ${isToggled ? "w-15" : "w-50"}
        `}
      >
        {/* TOP MENU */}
        <div className="relative min-w-15 top-0 left-0 w-full mt-10 space-y-6 flex flex-col items-start overflow-hidden">
          <Button
            className={`
              ${activeNav("/")}
              w-full transition-all relative left-0 top-0 duration-300
              justify-start gap-4
              text-white dark:text-gray-100
            `}
            variant="light"
            onPress={() => handleLink("/")}
          >
            <ChatBubbleLeftRightIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            <span className="truncate" suppressHydrationWarning>
              {t("sidebar.chats")}
            </span>
          </Button>

          <Button
            className={`
              ${activeNav("/contacts")}
              w-full transition-all relative left-0 top-0 duration-300
              justify-start gap-4
              text-white dark:text-gray-100
            `}
            variant="light"
            onPress={() => handleLink("/contacts")}
          >
            <UserPlusIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            <span className="truncate" suppressHydrationWarning>
              {t("sidebar.contacts")}
            </span>
          </Button>

          {/* Notifications — dropdown popover, không phải route riêng */}
          <NotificationDropdown />

          <Button
            className={`
              ${activeNav("/docs")}
              w-full transition-all relative left-0 top-0 duration-300
              justify-start gap-4
              text-white dark:text-gray-100
            `}
            variant="light"
            onPress={() => handleLink("/docs")}
          >
            <BookmarkIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            <span className="truncate" suppressHydrationWarning>
              {t("sidebar.files")}
            </span>
          </Button>

          <Button
            className={`
              ${activeNav("/flash-card")}
              w-full transition-all relative left-0 top-0 duration-300
              justify-start gap-4
              text-white dark:text-gray-100
            `}
            variant="light"
            onPress={() => handleLink("/flash-card")}
          >
            <RectangleStackIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            <span className="truncate" suppressHydrationWarning>
              Flash Card
            </span>
          </Button>

          <Button
            className={`
              ${activeNav("/todo")}
              w-full transition-all relative left-0 top-0 duration-300
              justify-start gap-4
              text-white dark:text-gray-100
            `}
            variant="light"
            onPress={() => handleLink("/todo")}
          >
            <ClipboardDocumentListIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            <span className="truncate" suppressHydrationWarning>
              Todo
            </span>
          </Button>
        </div>

        {/* BOTTOM USER + TOGGLE + THEME */}
        <div className="relative bottom-0 overflow-hidden flex flex-col gap-4 justify-center items-start mb-4">
          <Dropdown>
            <DropdownTrigger>
              <div className="flex w-full transition-all relative left-0 top-0 duration-300 justify-start items-center gap-4 text-white dark:text-gray-100 overflow-hidden cursor-pointer">
                <Avatar
                  className="relative block min-w-[40px] h-[40px]"
                  src={user?.avatar ?? ""}
                  name={user?.fullname ?? "User"}
                />
                <div className="relative left-0 bottom-0 whitespace-nowrap truncate max-w-[120px]">
                  {user?.fullname}
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem
                key="setting"
                onPress={() => handleLink("/settings")}
              >
                {t("sidebar.settings")}
              </DropdownItem>
              <DropdownItem
                key="logout"
                onPress={logout}
                className="text-danger"
                color="danger"
              >
                {t("sidebar.logout")}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button
            variant="light"
            size="sm"
            onPress={changeToggle}
            isIconOnly
            className="text-white dark:text-gray-100"
          >
            {isToggled ? (
              <Bars3BottomLeftIcon className="w-6 h-6" />
            ) : (
              <XCircleIcon className="w-6 h-6" />
            )}
          </Button>

          <ThemeSwitcher />
          <LanguageSwitcher />
        </div>
      </nav>
    </div>
  );
};
