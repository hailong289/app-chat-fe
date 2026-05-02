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

  const handleLink = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  // Active highlight — Desktop: background, Mobile: top border + text
  const activeDesktopNav = useCallback(
    (path: string) => {
      const isActive =
        path === "/" ? pathname === "/" : pathname.startsWith(path);
      return isActive ? "bg-default/40 dark:bg-slate-800" : "";
    },
    [pathname],
  );

  const activeMobileNav = useCallback(
    (path: string) => {
      const isActive =
        path === "/" ? pathname === "/" : pathname.startsWith(path);
      return isActive
        ? "text-white border-t-2 border-white"
        : "text-white/60 border-t-2 border-transparent";
    },
    [pathname],
  );

  const logout = useCallback(() => {
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

  // ─── Shared nav items ──────────────────────────────────────────────────────
  const navItems = [
    {
      path: "/",
      icon: <ChatBubbleLeftRightIcon className="w-6 h-6" />,
      label: t("sidebar.chats"),
    },
    {
      path: "/contacts",
      icon: <UserPlusIcon className="w-6 h-6" />,
      label: t("sidebar.contacts"),
    },
    {
      path: "/docs",
      icon: <BookmarkIcon className="w-6 h-6" />,
      label: t("sidebar.files"),
    },
    {
      path: "/flash-card",
      icon: <RectangleStackIcon className="w-6 h-6" />,
      label: "Flash Card",
    },
    {
      path: "/todo",
      icon: <ClipboardDocumentListIcon className="w-6 h-6" />,
      label: "Todo",
    },
  ];

  // ─── User Dropdown — dùng chung cho cả Desktop lẫn Mobile ─────────────────
  const userDropdown = (
    <Dropdown>
      <DropdownTrigger>
        <div className="flex items-center cursor-pointer">
          <Avatar
            className="relative block min-w-[36px] h-[36px]"
            src={user?.avatar ?? ""}
            name={user?.fullname ?? "User"}
          />
        </div>
      </DropdownTrigger>
      <DropdownMenu aria-label="User menu">
        <DropdownItem key="setting" onPress={() => handleLink("/settings")}>
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
  );

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          DESKTOP NAV — thanh dọc bên trái, ẨN hoàn toàn trên mobile (<md)
          ══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:block">
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
            {navItems.map((item) => (
              <Button
                key={item.path}
                className={`
                  ${activeDesktopNav(item.path)}
                  w-full transition-all relative left-0 top-0 duration-300
                  justify-start gap-4
                  text-white dark:text-gray-100
                `}
                variant="light"
                onPress={() => handleLink(item.path)}
              >
                <span className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100">
                  {item.icon}
                </span>
                <span className="truncate" suppressHydrationWarning>
                  {item.label}
                </span>
              </Button>
            ))}

            {/* Notifications dropdown */}
            <NotificationDropdown />
          </div>

          {/* BOTTOM: User avatar + Toggle + Theme/Language */}
          <div className="relative bottom-0 overflow-hidden flex flex-col gap-4 justify-center items-start mb-4">
            <div className="flex w-full transition-all relative left-0 top-0 duration-300 justify-start items-center gap-4 text-white dark:text-gray-100 overflow-hidden">
              {userDropdown}
              {!isToggled && (
                <div className="relative left-0 bottom-0 whitespace-nowrap truncate max-w-[120px]">
                  {user?.fullname}
                </div>
              )}
            </div>

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

      {/* ══════════════════════════════════════════════════════════════
          MOBILE BOTTOM NAV — thanh ngang dưới đáy, CHỈ hiện trên mobile (<md)
          Dùng `fixed` để luôn nằm cố định dưới cùng màn hình.
          Hỗ trợ Safe Area Inset (notch / home indicator trên iPhone/Android).
          ══════════════════════════════════════════════════════════════ */}
      <nav
        className="
          md:hidden
          fixed bottom-0 left-0 right-0 z-50
          flex flex-row items-stretch justify-around
          bg-primary dark:bg-slate-900
          shadow-[0_-4px_16px_rgba(0,0,0,0.25)]
        "
        style={{
          height: "calc(56px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            className={`
              flex flex-col items-center justify-center flex-1 gap-0.5 pt-1
              transition-all duration-200
              ${activeMobileNav(item.path)}
            `}
            onClick={() => handleLink(item.path)}
          >
            {item.icon}
            <span className="text-[9px] font-medium leading-none" suppressHydrationWarning>
              {item.label}
            </span>
          </button>
        ))}

        {/* Notifications icon */}
        <div className="flex flex-col items-center justify-center flex-1 pt-1 border-t-2 border-transparent">
          <NotificationDropdown mobileMode />
        </div>

        {/* User Avatar + tên viết tắt */}
        <div className="flex flex-col items-center justify-center flex-1 pt-1">
          {userDropdown}
          <span className="text-[9px] font-medium text-white/60 mt-0.5 leading-none" suppressHydrationWarning>
            {user?.fullname?.split(" ").pop() ?? ""}
          </span>
        </div>
      </nav>
    </>
  );
};
