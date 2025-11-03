"use client";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import useCounterStore from "@/store/useCounterStore";

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

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout: handleLogout } = useAuthStore();
  const { success, error: showError } = useToast();
  const userState = useAuthStore((state) => state);
  const counterState = useCounterStore((state) => state);
  // const [room, setRoom] = useState<Record<string, any>>([{}]);
  // Chỉ truy cập localStorage sau khi component mount

  const changeToggle = () => {
    counterState.setToggleState(!counterState.isToggled);
  };

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
        console.log(error);
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
          counterState.isToggled ? "w-15" : "w-50"
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
                  src={userState.user?.avatar ? userState.user?.avatar : ""}
                  name={userState.user?.fullname || "User"}
                />
                <div className="relative left-0 bottom-0 whitesspace-nowrap">
                  {userState.user?.fullname}
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
            {counterState.isToggled ? <Bars3BottomLeftIcon /> : <XCircleIcon />}
          </Button>
        </div>
      </nav>
    </div>
  );
};
