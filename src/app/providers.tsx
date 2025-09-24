// app/providers.tsx
"use client";

import { HeroUIProvider } from "@heroui/react";

export function Providers({ children }: { readonly children: React.ReactNode }) {
  return <HeroUIProvider>{children}</HeroUIProvider>;
}
