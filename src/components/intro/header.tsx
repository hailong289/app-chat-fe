"use client";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import {
  AdjustmentsHorizontalIcon,
  Bars3BottomLeftIcon,
  BookmarkIcon,
  ClockIcon,
  HeartIcon,
  UserCircleIcon,
  UserPlusIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/outline";
import { DocumentIcon } from "@heroicons/react/24/outline";
import { ArrowLeftEndOnRectangleIcon } from "@heroicons/react/24/solid";
import {
  BellIcon,
  ChatBubbleLeftRightIcon,
  Cog8ToothIcon,
  HomeIcon,
  HomeModernIcon,
  TvIcon,
} from "@heroicons/react/24/solid";
import {
  Avatar,
  Badge,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout: handleLogout } = useAuthStore();
  const { success, error: showError } = useToast();
  const [isToggledState, setIsToggledState] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);

  // Chỉ truy cập localStorage sau khi component mount
  useEffect(() => {
    const isToggled = localStorage.getItem("isSideBarToggled") === "true";
    setIsToggledState(isToggled);

    // Lấy user info từ localStorage
    try {
      const authStorage = localStorage.getItem("auth-storage");
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        setUserInfo(parsed?.state?.user);
      }
    } catch (error) {
      console.error("Error parsing auth-storage:", error);
    }
  }, []);

  const changeToggle = () => {
    const newToggleState = !isToggledState;
    localStorage.setItem("isSideBarToggled", newToggleState.toString());
    setIsToggledState(newToggleState);
    console.log(newToggleState);
  };

  console.log("🚀 ~ Header ~ userInfo:", userInfo);
  const handleLink = (tab: string, path: string = "") => {
    if (path) {
      router.push(`${path}`);
    } else {
      router.push(`${pathname}?tab=${tab}`);
    }
  };

  const activeTab = (tab: string) => {
    if (
      pathname.includes("/settings") &&
      !searchParams.get("tab") &&
      tab === "settings"
    ) {
      return "active-menu-item";
    }
    return searchParams.get("tab") === tab ? "bg-default/40" : "";
  };

  const logout = () => {
    handleLogout((error) => {
      if (error) {
        showError("Đăng xuất thất bại. Vui lòng thử lại.");
        return;
      }
      success("Đăng xuất thành công!");
      router.push("/auth");
    });
  };
  return (
    <div>
      <nav
        className={`relative flex flex-col justify-between top-0 left-0 bg-primary px-1 overflow-hidden transition-all duration-300  ${
          isToggledState ? "w-15" : "w-50"
        } h-screen`}
      >
        <div className=" relative min-w-15 bg-primary top-0 left-0  w-full mt-10 space-y-6 flex flex-col items-start overflow-hidden">
          <Button
            className={`${activeTab(
              ""
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white`}
            variant="light"
            onPress={() => router.push("/")}
          >
            <ChatBubbleLeftRightIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Đoạn chat</span>
          </Button>
          <Button
            className={`${activeTab(
              "contacts"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white`}
            variant="light"
            onPress={() => handleLink("contacts")}
          >
            <UserPlusIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Bạn bè</span>
          </Button>
          <Button
            className={`${activeTab(
              "notifications"
            )} w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 `}
            variant="light"
            onPress={() => handleLink("notifications")}
          >
            <Badge color="danger" content="5">
              <BellIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
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
            <BookmarkIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Tệp</span>
          </Button>
        </div>
        <div
          className={`relative  bottom-0 overflow-hidden  flex flex-col gap-4 justify-center items-start mb-4`}
        >
          <Dropdown>
            <DropdownTrigger>
              <div className="flex  w-full transition-all relative left-0 top-0 duration-300 justify-start items-center gap-4 text-white overflow-hidden">
                <Avatar
                  className=" relative block  min-w-[40px] h-[40px] text-white"
                  src={
                    userInfo?.avatar
                      ? userInfo?.avatar
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          userInfo?.fullname
                        )}&background=random`
                  }
                />
                <div className="relative left-0 bottom-0 whitesspace-nowrap">
                  {userInfo?.fullname}
                </div>
              </div>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Example with disabled actions"
              disabledKeys={["edit", "delete"]}
            >
              <DropdownItem key="profile" onPress={() => console.log("hồ sơ")}>
                Hồ Sơ
              </DropdownItem>
              <DropdownItem
                key="setting"
                onPress={() => handleLink("settings")}
              >
                Cài Đặt
              </DropdownItem>
              <DropdownItem key="logout" onPress={() => logout()}>
                Đăng Xuất
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button variant="light" size="sm" onPress={() => changeToggle()}>
            {isToggledState ? <Bars3BottomLeftIcon /> : <XCircleIcon />}
          </Button>
        </div>
      </nav>
    </div>
  );
};
