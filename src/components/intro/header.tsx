"use client";

import { Button, Navbar, NavbarBrand, NavbarContent, NavbarItem } from "@heroui/react";
import Link from "next/link";

export const Header = () => {
  return (
    <Navbar
      maxWidth="2xl"
      className="bg-background/70 backdrop-blur border-b border-divider"
    >
      <NavbarBrand>
        <Link href="/" className="flex items-center gap-2">
          <div className="size-9 grid place-items-center rounded-md bg-foreground text-background font-bold">
            C
          </div>
          <span className="font-semibold bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            ChatApp
          </span>
        </Link>
      </NavbarBrand>
      <NavbarContent justify="end" className="hidden sm:flex">
        <NavbarItem>
          <Link
            href="#features"
            className="text-foreground-600 hover:text-primary"
          >
            Tính năng
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            href="#about"
            className="text-foreground-600 hover:text-primary"
          >
            Giới thiệu
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link
            href="#contact"
            className="text-foreground-600 hover:text-primary"
          >
            Liên hệ
          </Link>
        </NavbarItem>
      </NavbarContent>
      <NavbarContent justify="end">
        <Button as={Link} href="#" color="primary" size="sm">
          Trải nghiệm ngay
        </Button>
      </NavbarContent>
    </Navbar>
  );
};
