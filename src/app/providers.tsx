// app/providers.tsx
"use client";

import "@/i18n";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { HeroUIProvider, ToastProvider } from "@heroui/react";

export function Providers({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <NextThemesProvider
      attribute="class" // 🔥 BẮT BUỘC: dùng class (light / dark)
      defaultTheme="system" // hoặc "light" tùy ông
      enableSystem // cho phép theo system
      themes={["light", "dark"]}
    >
      <HeroUIProvider>
        <ToastProvider />
        {children}
      </HeroUIProvider>
    </NextThemesProvider>
  );
}
