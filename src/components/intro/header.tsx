"use client";
import useToast from "@/hooks/useToast";
import useAuthStore from "@/store/useAuthStore";
import { UserCircleIcon } from "@heroicons/react/16/solid";
import { ArrowLeftCircleIcon } from "@heroicons/react/24/outline";
import { DocumentIcon } from "@heroicons/react/24/outline";
import { ArrowLeftEndOnRectangleIcon } from "@heroicons/react/24/solid";
import { BellIcon, ChatBubbleLeftRightIcon, Cog8ToothIcon, HomeIcon, HomeModernIcon, TvIcon } from "@heroicons/react/24/solid";
import { Button, Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export const Header = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout: handleLogout } = useAuthStore();
  const { success, error: showError } = useToast();

  const handleLink = (tab: string, path: string = '') => {
    if (path) {
      router.push(`${path}`);
    } else {
      router.push(`${pathname}?tab=${tab}`);
    }
  }

  const activeTab = (tab: string) => {
    if (pathname.includes('/settings') && !searchParams.get("tab") && tab === 'settings') {
      return 'active-menu-item';
    }
    return searchParams.get("tab") === tab ? 'active-menu-item' : '';
  }

  const logout = () => {
    handleLogout((error) => {
      if (error) {
        showError('Đăng xuất thất bại. Vui lòng thử lại.');
        return;
      }
      success('Đăng xuất thành công!');
      router.push('/auth');
    });
  }
  return (
    <Navbar
      className="bg-primary h-full items-start"
      maxWidth="full"
    >
      <NavbarBrand className="mb-10 absolute top-4 left-0 w-full h-22 flex items-center justify-center border-b border-white/20">
        <Image
          src="/logo.png"
          alt="ChatApp Logo"
          width={80}
          height={80}
          onClick={() => router.push('/')}
          className="cursor-pointer"
        />
        {/* <span className="text-2xl font-bold">ChatApp</span> */}
      </NavbarBrand>
      <NavbarContent className="flex-col gap-7 items-start mt-[16rem]">
        {/* Logo */}
        <NavbarItem className={`relative ${activeTab('messages')}`}>
          <Button isIconOnly color="primary" aria-label="ChatApp Home" onPress={() => handleLink('messages')}>
            <ChatBubbleLeftRightIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem className={`relative ${activeTab('contacts')}`}>
          <Button isIconOnly color="primary" aria-label="Contacts" onPress={() => handleLink('contacts')}>
            <UserCircleIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem className={`relative ${activeTab('notifications')}`}>
          <Button isIconOnly color="primary" aria-label="Notifications" onPress={() => handleLink('notifications')}>
            <BellIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem className={`relative ${activeTab('documents')}`}>
          <Button isIconOnly color="primary" aria-label="Documents" onPress={() => handleLink('documents')}>
            <DocumentIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem className={`relative ${activeTab('settings')}`}>
          <Button isIconOnly color="primary" aria-label="Settings" onPress={() => handleLink('settings', '/settings')}>
            <Cog8ToothIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem className={`relative ${activeTab('logout')}`}>
          <Button isIconOnly color="primary" aria-label="Logout" onPress={() => logout()}>
            <ArrowLeftEndOnRectangleIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};
