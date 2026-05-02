"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  Suspense,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Header } from "@/components/intro/header";
import { LeftSide } from "@/components/intro/left-side";
import { useFirebase } from "@/components/providers/firebase.provider";
import { Button, Tooltip } from "@heroui/react";
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/solid";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "@/components/providers/SocketProvider";
import useRoomStore from "@/store/useRoomStore";
import useAuthStore from "@/store/useAuthStore";
import { tokenStorage } from "@/utils/tokenStorage";
import { openDbForUser } from "@/libs/db";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const path = usePathname();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const collapsedSidebar = useCounterStore((state) => state.collapsedSidebar);
  const toggleSidebar = useCounterStore((state) => state.togoleSidebar);
  const currentRoom = useRoomStore((state) => state.room);
  const [mounted, setMounted] = useState(false);

  // Auth bootstrap moved to <AuthBootstrap/> in app/providers.tsx so
  // it covers EVERY page tree — including the /call popup window which
  // doesn't use this ClientLayout. Without that, the call window
  // opened with no user state and acceptCall silently failed.

  /**
   * Client-side route guard. Replaces the previous Next.js middleware
   * check — middleware can no longer see auth state because:
   *   - the HttpOnly `tokens` cookie is scoped to /auth, so the browser
   *     doesn't send it on `/`, `/chat`, etc.
   *   - the accessToken lives in localStorage, which the Edge runtime
   *     can't read.
   *
   * Behaviour:
   *   - Protected route + not authenticated → redirect to /auth
   *   - /auth + already authenticated → redirect to /chat
   *
   * Reads `isAuthenticated` from the Zustand store, which the boot
   * effect in useAuthStore seeds synchronously from
   * `localStorage["accessToken"]` so we don't flash a redirect while
   * fetchMe() is still resolving the user profile.
   */
  useEffect(() => {
    if (!path) return;
    const isAuthRoute = path === "/auth" || path.startsWith("/auth/");
    const isPublic = isAuthRoute || path === "/dashboard";

    if (isAuthenticated && isAuthRoute) {
      router.replace("/chat");
      return;
    }
    if (!isAuthenticated && !isPublic) {
      router.replace("/auth");
    }
  }, [isAuthenticated, path, router]);
  const DEFAULT_SIDEBAR_WIDTH = 320;
  const COLLAPSED_SIDEBAR_WIDTH = 72;
  const [sidebarWidth, setSidebarWidth] = useState(
    collapsedSidebar ? COLLAPSED_SIDEBAR_WIDTH : DEFAULT_SIDEBAR_WIDTH,
  );
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    startX: 0,
    startWidth: DEFAULT_SIDEBAR_WIDTH,
    lastWidth: DEFAULT_SIDEBAR_WIDTH,
  });
  const previousWidthRef = useRef(DEFAULT_SIDEBAR_WIDTH);

  const MIN_SIDEBAR_WIDTH = 240;
  const MAX_SIDEBAR_WIDTH = 480;

  // Socket Listener for Room Updates
  const { socket } = useSocket();
  useEffect(() => {
    setMounted(true);
  }, []);

  // Trang auth: /auth, /auth/login, /auth/register, ...
  const isAuthPage = path.startsWith("/auth");

  // Những route dùng layout app chính
  const appRoutes = ["/", "/chat", "/settings", "/contacts", "/docs"];
  const isInAppRoute = appRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  const isDisableLeftSide = path.includes("/flash-card") || path.includes("/todo");

  // Dùng layout đơn giản cho: auth + các route không thuộc appRoutes (kiểu 404 / intro riêng)
  const useSimpleLayout = isAuthPage || !isInAppRoute;

  useEffect(() => {
    // Only ask for notification permission AFTER the user has signed
    // in. Prompting on the auth/landing page is bad UX (user has no
    // context for what the notifications are for) and on Chrome it
    // even contributes to permission-quality scoring that can downgrade
    // future requests. Gating on `isAuthenticated` defers the ask
    // until the user is committed to the app.
    if (!isAuthenticated) return;
    const requestPermission = async () => {
      try {
        await firebase.requestPermission();
      } catch (err) {
        console.error("🚫 Không thể cấp quyền thông báo.", err);
      }
    };
    requestPermission();
  }, [firebase, isAuthenticated]);
  // Define valid routes
  const validRoutes = ["/", "/chat", "/settings", "/contacts", '/flash-card', '/todo'];
  const isValidRoute =
    !validRoutes.some(
      (route) => path === route || path.startsWith(route + "/"),
    ) ||
    isAuthPage ||
    path.startsWith("/call");

  const handleResizeStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (collapsedSidebar) {
        toggleSidebar();
        return;
      }
      event.preventDefault();
      const startX = event.clientX;
      const startWidth =
        sidebarRef.current?.getBoundingClientRect().width ?? sidebarWidth;
      dragStateRef.current = {
        startX,
        startWidth,
        lastWidth: startWidth,
      };
      setIsResizing(true);
    },
    [collapsedSidebar, sidebarWidth, toggleSidebar],
  );

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      const delta = event.clientX - dragStateRef.current.startX;
      const nextWidth = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, dragStateRef.current.startWidth + delta),
      );
      setSidebarWidth(nextWidth);
      dragStateRef.current.lastWidth = nextWidth;
    };

    const handlePointerUp = () => {
      previousWidthRef.current = dragStateRef.current.lastWidth;
      setIsResizing(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (collapsedSidebar) {
      if (sidebarWidth !== COLLAPSED_SIDEBAR_WIDTH) {
        if (sidebarWidth > COLLAPSED_SIDEBAR_WIDTH) {
          previousWidthRef.current = sidebarWidth;
        }
        setSidebarWidth(COLLAPSED_SIDEBAR_WIDTH);
      }
    } else if (sidebarWidth === COLLAPSED_SIDEBAR_WIDTH) {
      setSidebarWidth(previousWidthRef.current || DEFAULT_SIDEBAR_WIDTH);
    }
  }, [collapsedSidebar, sidebarWidth]);

  const collapseButton = useMemo(
    () => (
      <Tooltip
        content={collapsedSidebar ? "Mở rộng danh sách" : "Thu gọn danh sách"}
        placement="bottom"
      >
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="text-foreground"
          onPress={toggleSidebar}
        >
          {collapsedSidebar ? (
            <ChevronDoubleRightIcon className="w-5 h-5" />
          ) : (
            <ChevronDoubleLeftIcon className="w-5 h-5" />
          )}
        </Button>
      </Tooltip>
    ),
    [collapsedSidebar, toggleSidebar],
  );

  if (isValidRoute) {
    // layout cho trang login/register/404 — không có Bottom Nav
    return <main className="w-full h-screen">{children}</main>;
  }

  // Layout chính của app chat
  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-900 text-foreground pt-[env(safe-area-inset-top,0px)]">
      {/* Desktop nav — ẩn trên mobile (<md), Header tự render Bottom Nav riêng */}
      <nav className="relative h-full hidden md:block">
        <Suspense fallback={<div className="w-[60px] h-full" />}>
          <Header />
        </Suspense>
      </nav>

      {/* Mobile Bottom Nav — Header tự render fixed bottom nav, đặt trong Suspense */}
      <div className="md:hidden">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
      </div>

      <main className="flex-1 h-screen flex overflow-hidden">
        {/* Global socket listener / toasts / events */}

        {!isDisableLeftSide && (
          <>
            <div
              ref={sidebarRef}
              className={`
                relative h-full shrink-0
                /* Mobile: LeftSide chiếm full width, ẩn khi đang xem Chat detail */
                w-full
                ${currentRoom ? "hidden md:block" : "block"}
              `}
              style={{ width: typeof window !== "undefined" && window.innerWidth >= 768 ? `${sidebarWidth}px` : undefined }}
            >
              <div className="absolute top-3 right-3 z-20 hidden md:block">{collapseButton}</div>
              <Suspense fallback={<div className="h-full" />}>
                <LeftSide />
              </Suspense>
              {/* Resize handle — chỉ dùng trên Desktop */}
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                className={`hidden md:block absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors ${
                  isResizing
                    ? "bg-primary/40"
                    : "bg-transparent hover:bg-primary/20"
                }`}
                onPointerDown={handleResizeStart}
              />
            </div>
          </>
        )}

        {/* Main content area — thêm padding-bottom trên mobile để không bị Bottom Nav che (chỉ khi không trong chat) */}
        <div
          className={`flex-1 overflow-y-auto h-screen ${!currentRoom ? "pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pb-0" : "pb-0"}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
