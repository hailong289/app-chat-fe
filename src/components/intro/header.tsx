"use client";

import { toast } from "@/store/useToastStore";
import useAuthStore from "@/store/useAuthStore";
import useCounterStore from "@/store/useCounterStore";
import useRoomStore from "@/store/useRoomStore";
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
  const currentRoom = useRoomStore((state) => state.room);
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

  // ─── Mobile More Dropdown (Gộp các tính năng phụ) ──────────────────────────
  const mobileMoreDropdown = (
    <Dropdown placement="top-end">
      <DropdownTrigger>
        <button
          type="button"
          className={`
            flex items-center justify-center
            transition-all duration-300
            ${
              ["/flash-card", "/todo", "/settings"].some((p) => pathname.startsWith(p))
                ? "bg-white text-primary w-12 h-12 rounded-full shadow-sm"
                : "text-white/60 hover:text-white w-12 h-12"
            }
          `}
        >
          <Avatar
            className="w-7 h-7 min-w-[28px]"
            src={user?.avatar ?? ""}
            name={user?.fullname ?? "User"}
          />
        </button>
      </DropdownTrigger>
      <DropdownMenu aria-label="More menu" className="text-foreground">
        <DropdownItem
          key="flash-card"
          startContent={<RectangleStackIcon className="w-5 h-5" />}
          onPress={() => handleLink("/flash-card")}
        >
          Flash Card
        </DropdownItem>
        <DropdownItem
          key="todo"
          startContent={<ClipboardDocumentListIcon className="w-5 h-5" />}
          onPress={() => handleLink("/todo")}
        >
          Todo
        </DropdownItem>
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
      <div
        className={`
          md:hidden
          fixed bottom-0 left-0 w-full z-50
          flex justify-center
          ${currentRoom ? "hidden" : "flex"}
        `}
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        <nav
          className={`
            flex flex-row items-center justify-between
            bg-primary dark:bg-slate-800
            rounded-full
            px-2 py-2
            shadow-[0_8px_30px_rgba(0,0,0,0.4)]
            w-[92%] max-w-[420px]
          `}
        >
          {/* Chỉ render 3 item chính: Chat, Danh bạ, Tệp */}
          {navItems.slice(0, 3).map((item) => {
            const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                type="button"
                className={`
                  flex items-center justify-center
                  transition-all duration-300
                  ${
                    isActive
                      ? "bg-white text-primary w-12 h-12 rounded-full shadow-sm"
                      : "text-white/60 hover:text-white w-12 h-12"
                  }
                `}
                onClick={() => handleLink(item.path)}
              >
                <div className={`${isActive ? "scale-110" : "scale-100"} transition-transform`}>
                  {item.icon}
                </div>
              </button>
            );
          })}

          {/* Notifications icon */}
          {(() => {
            const isActive = pathname.startsWith("/notifications");
            return (
              <div
                className={`
                  flex items-center justify-center
                  transition-all duration-300
                  ${
                    isActive
                      ? "bg-white text-primary w-12 h-12 rounded-full shadow-sm"
                      : "text-white/60 hover:text-white w-12 h-12"
                  }
                `}
              >
                <div className={`${isActive ? "scale-110" : "scale-100"} transition-transform w-full h-full flex items-center justify-center`}>
                  <NotificationDropdown mobileMode />
                </div>
              </div>
            );
          })()}

          {/* User Avatar (Mở More Menu) */}
          {mobileMoreDropdown}
        </nav>
      </div>
    </>
  );
};
