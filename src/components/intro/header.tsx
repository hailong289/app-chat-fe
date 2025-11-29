"use client";

import { toast } from "@/store/useToastStore";
import useAuthStore from "@/store/useAuthStore";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "@/components/providers/SocketProvider";
import { clearAllLocalStorage } from "@/utils/localStorage";
import {
  Bars3BottomLeftIcon,
  BookmarkIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import { BellIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/solid";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ThemeSwitcher } from "../ThemeSwitcher";

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { logout: handleLogout, user } = useAuthStore();
  const { isToggled, tab, setToggleState, setTab } = useCounterStore();
  const { disconnect: disconnectSocket } = useSocket();

  const changeToggle = useCallback(() => {
    setToggleState(!isToggled);
  }, [isToggled, setToggleState]);

  const handleLink = useCallback(
    (tabName: string, path: string = "") => {
      if (path === "/" && tabName === "") {
        setTab("home");
      } else {
        setTab(tabName);
      }

      if (path) {
        router.push(path);
      } else {
        router.push(`${pathname}?tab=${tabName}`);
      }
    },
    [pathname, router, setTab]
  );

  const activeTab = useCallback(
    (tabName: string) => {
      if (
        pathname.includes("/settings") &&
        !searchParams.get("tab") &&
        tabName === "settings"
      ) {
        return "active-menu-item";
      }
      return searchParams.get("tab") === tabName || tab === tabName
        ? "bg-default/40"
        : "";
    },
    [pathname, searchParams, tab]
  );

  const logout = useCallback(() => {
    // Ngắt kết nối socket trước khi logout
    disconnectSocket();

    // Xóa tất cả localStorage

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
        className={`relative flex flex-col justify-between top-0 left-0 bg-primary px-1 overflow-hidden transition-all duration-300 ${
          isToggled ? "w-15" : "w-50"
        } h-screen`}
      >
        <div className="relative min-w-15 bg-primary top-0 left-0 w-full mt-10 space-y-6 flex flex-col items-start overflow-hidden">
          <Button
            className={`${activeTab(
              "home"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white`}
            variant="light"
            onPress={() => handleLink("", "/")}
          >
            <ChatBubbleLeftRightIcon className="relative block min-w-[24px] h-[24px] text-white" />
            <span>Đoạn chat</span>
          </Button>

          <Button
            className={`${activeTab(
              "contacts"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white`}
            variant="light"
            onPress={() => handleLink("contacts", "/contacts")}
          >
            <UserPlusIcon className="relative block min-w-[24px] h-[24px] text-white" />
            <span>Bạn bè</span>
          </Button>

          <Button
            className={`${activeTab(
              "notifications"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4`}
            variant="light"
            onPress={() => handleLink("notifications")}
          >
            <Badge color="danger" content="5">
              <BellIcon className="relative block min-w-[24px] h-[24px] text-white" />
            </Badge>
            <span className="text-white">Thông Báo</span>
          </Button>

          <Button
            className={`${activeTab(
              "documents"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white`}
            variant="light"
            onPress={() => handleLink("documents")}
          >
            <BookmarkIcon className="relative block min-w-[24px] h-[24px] text-white" />
            <span>Tệp</span>
          </Button>
        </div>

        <div className="relative bottom-0 overflow-hidden flex flex-col gap-4 justify-center items-start mb-4">
          <Dropdown>
            <DropdownTrigger>
              <div className="flex w-full transition-all relative left-0 top-0 duration-300 justify-start items-center gap-4 text-white overflow-hidden cursor-pointer">
                <Avatar
                  className="relative block min-w-[40px] h-[40px] text-white"
                  src={user?.avatar ?? ""}
                  name={user?.fullname ?? "User"}
                />
                <div className="relative left-0 bottom-0 whitespace-nowrap">
                  {user?.fullname}
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="User menu">
              <DropdownItem key="profile">Hồ Sơ</DropdownItem>
              <DropdownItem
                key="setting"
                onPress={() => handleLink("settings")}
              >
                Cài Đặt
              </DropdownItem>
              <DropdownItem
                key="logout"
                onPress={logout}
                className="text-danger"
                color="danger"
              >
                Đăng Xuất
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <Button variant="light" size="sm" onPress={changeToggle} isIconOnly>
            {isToggled ? (
              <Bars3BottomLeftIcon className="w-6 h-6" />
            ) : (
              <XCircleIcon className="w-6 h-6" />
            )}
          </Button>
          <ThemeSwitcher />
        </div>
      </nav>
    </div>
  );
};
