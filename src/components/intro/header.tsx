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
import { useState } from "react";

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout: handleLogout } = useAuthStore();
  const { success, error: showError } = useToast();
  const isToggled = localStorage.getItem("isSideBarToggled") === "true";
  const [isToggledState, setIsToggledState] = useState(isToggled);
  const changeToggle = () => {
    localStorage.setItem("isSideBarToggled", (!isToggled).toString());
    setIsToggledState(!isToggled);
    console.log(!isToggled);
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
    return searchParams.get("tab") === tab ? "active-menu-item" : "";
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
    // <Navbar
    //   className=" h-full items-start"
    //   maxWidth="full"
    // >
    //   <NavbarBrand className="mb-10 absolute top-4 left-0 w-full h-22 flex items-center justify-center border-b border-white/20">
    //     <Image
    //       src="/logo.png"
    //       alt="ChatApp Logo"
    //       width={80}
    //       height={80}
    //       onClick={() => router.push('/')}
    //       className="cursor-pointer"
    //     />
    //     {/* <span className="text-2xl font-bold">ChatApp</span> */}
    //   </NavbarBrand>
    //   <NavbarContent className="flex-col gap-7 items-start mt-[16rem]">
    //     {/* Logo */}
    //     <NavbarItem className={`relative ${activeTab('messages')}`}>
    //       <Button isIconOnly color="primary" aria-label="ChatApp Home" onPress={() => handleLink('messages')}>
    //         <ChatBubbleLeftRightIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //     <NavbarItem className={`relative ${activeTab('contacts')}`}>
    //       <Button isIconOnly color="primary" aria-label="Contacts" onPress={() => handleLink('contacts')}>
    //         <UserCircleIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //     <NavbarItem className={`relative ${activeTab('notifications')}`}>
    //       <Button isIconOnly color="primary" aria-label="Notifications" onPress={() => handleLink('notifications')}>
    //         <BellIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //     <NavbarItem className={`relative ${activeTab('documents')}`}>
    //       <Button isIconOnly color="primary" aria-label="Documents" onPress={() => handleLink('documents')}>
    //         <DocumentIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //     <NavbarItem className={`relative ${activeTab('settings')}`}>
    //       <Button isIconOnly color="primary" aria-label="Settings" onPress={() =>` handleLink('settings', '/settings')`}>
    //         <Cog8ToothIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //     <NavbarItem className={`relative ${activeTab('logout')}`}>
    //       <Button isIconOnly color="primary" aria-label="Logout" onPress={() => logout()}>
    //         <ArrowLeftEndOnRectangleIcon className="h-20 w-20" />
    //       </Button>
    //     </NavbarItem>
    //   </NavbarContent>
    // </Navbar>
    <div>
      <nav
        className={`relative flex flex-col top-0 left-0 bg-primary px-1 overflow-hidden transition-all duration-300  ${
          isToggledState ? "w-15" : "w-80"
        } h-screen`}
      >
        <div className=" relative min-w-15 bg-primary top-0 left-0  w-full mt-10 space-y-6 flex flex-col items-start overflow-hidden">
          <Button
            className="w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white"
            variant="light"
            onPress={() => router.push("/")}
          >
            <ChatBubbleLeftRightIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Đoạn chat</span>
          </Button>
          <Button
            className="w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white"
            variant="light"
            onPress={() => handleLink("contacts")}
          >
            <UserPlusIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Bạn bè</span>
          </Button>
          <Button
            className="w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 "
            variant="light"
            onPress={() => handleLink("notifications")}
          >
            <Badge color="danger" content="5">
              <BellIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            </Badge>
            <span className="text-white">Thông Báo</span>
          </Button>
          <Button
            className="w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white"
            variant="light"
            onPress={() => handleLink("documents")}
          >
            <BookmarkIcon className=" relative block  min-w-[24px] h-[24px] text-white" />
            <span>Tệp</span>
          </Button>
        </div>
        <div className="fixed px-1 bottom-0 overflow-hidden w-10 flex flex-col gap-4 justify-center items-center mb-4">
          <Dropdown>
            <DropdownTrigger>
              <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" />
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
                onPress={() => handleLink('settings', '/settings')}
              >
                Cài Đặt
              </DropdownItem>
              <DropdownItem key="logout">Đăng Xuất</DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button variant="light" onPress={() => changeToggle()}>
            {isToggledState ? <Bars3BottomLeftIcon /> : <XCircleIcon />}
          </Button>
        </div>
      </nav>
    </div>
  );
};
