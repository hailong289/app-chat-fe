// app/providers.tsx
"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";

export function Providers({ children }: { readonly children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      <ToastProvider />
      {children}
    </HeroUIProvider>
  );
}
