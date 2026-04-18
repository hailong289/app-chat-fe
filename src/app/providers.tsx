// app/providers.tsx
"use client";

import "@/i18n";
import "@mantine/core/styles.css";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { MantineProvider } from "@mantine/core";
import AlertModal from "@/components/modals/AlertModal";

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
      {/* MantineProvider is required by BlockNote v0.48 (uses @blocknote/mantine).
          Without it, popovers like FilePanel and SuggestionMenu render but
          their interactive elements (FileInput, Tabs, buttons) silently fail
          on click because Mantine's component context is missing. */}
      <MantineProvider>
        <HeroUIProvider>
          <ToastProvider />
          <AlertModal />
          {children}
        </HeroUIProvider>
      </MantineProvider>
    </NextThemesProvider>
  );
}
