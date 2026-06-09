// app/providers.tsx
"use client";

import { syncLanguageFromStorage } from "@/i18n";
import "@mantine/core/styles.css";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { MantineProvider } from "@mantine/core";
import { useEffect } from "react";
import AlertModal from "@/components/modals/AlertModal";
import useAuthStore from "@/store/useAuthStore";
import { tokenStorage } from "@/utils/tokenStorage";
import { openDbForUser } from "@/libs/db";
import { runCatchupSync, initSyncListener } from "@/libs/syncEngine";

/**
 * Bootstrap auth state on every client tree mount — covers BOTH the
 * main app shell (ClientLayout) AND the /call popup window (which has
 * its own bare layout). Previously this lived inside ClientLayout, so
 * the call window opened with `useAuthStore.user === null`, which
 * crashed acceptCall on `currentUser.id` and silently dropped the
 * call:accepted socket emit. Symptom: receiver UI shows "Connected"
 * but caller never gets the offer.
 *
 * Module-level effects in useAuthStore.ts didn't always re-run on full
 * page reloads under Next.js dev (HMR module cache), so the React
 * effect at the Providers level is the most reliable trigger.
 */
function AuthBootstrap() {
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!tokenStorage.get()) return;
    if (user) return;
    void fetchMe().then(() => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      try {
        openDbForUser(userId);
        // Catch-up event-sync: bù delta sau login/mở lại thay vì full-refetch.
        // Tự cold-start (full-load) bên trong nếu lần đầu / cursor quá cũ.
        initSyncListener();
        void runCatchupSync();
      } catch (err) {
        console.warn("[auth boot] openDbForUser / catchup failed", err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  return null;
}

function I18nLanguageSync() {
  useEffect(() => {
    syncLanguageFromStorage();
  }, []);
  return null;
}

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
          <AuthBootstrap />
          <I18nLanguageSync />
          <ToastProvider />
          <AlertModal />
          {children}
        </HeroUIProvider>
      </MantineProvider>
    </NextThemesProvider>
  );
}
