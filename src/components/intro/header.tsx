"use client";
import { UserCircleIcon } from "@heroicons/react/16/solid";
import { ChatBubbleBottomCenterIcon } from "@heroicons/react/20/solid";
import { BellIcon, ChatBubbleLeftRightIcon, Cog8ToothIcon, HomeIcon, HomeModernIcon, TvIcon } from "@heroicons/react/24/solid";
import { Button, Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";

export const Header = () => {
  return (
    <Navbar
      className="bg-primary h-full justify-start items-start"
      maxWidth="full"
    >
      <NavbarBrand className="mb-10 absolute top-4 left-0 w-full h-22 flex items-center justify-center border-b border-white/20">
        <Image
          src="/logo.png"
          alt="ChatApp Logo"
          width={80}
          height={80}
        />
        {/* <span className="text-2xl font-bold">ChatApp</span> */}
      </NavbarBrand>
      <NavbarContent className="flex-col gap-7 items-start mt-[16rem]">
        {/* Logo */}
        <NavbarItem>
          <Button isIconOnly color="primary" aria-label="ChatApp Home" as={Link} href="/">
            <ChatBubbleLeftRightIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem>
          <Button isIconOnly color="primary" aria-label="Contacts" as={Link} href="/me">
            <UserCircleIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem>
          <Button isIconOnly color="primary" aria-label="Notifications" as={Link} href="/me">
            <BellIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
        <NavbarItem>
          <Button isIconOnly color="primary" aria-label="Settings" as={Link} href="/me">
            <Cog8ToothIcon className="h-20 w-20" />
          </Button>
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};
