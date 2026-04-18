"use client";

import { usePathname } from "next/navigation";
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

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const firebase = useFirebase();
  const path = usePathname();
  const collapsedSidebar = useCounterStore((state) => state.collapsedSidebar);
  const toggleSidebar = useCounterStore((state) => state.togoleSidebar);
  const [mounted, setMounted] = useState(false);
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
    const requestPermission = async () => {
      try {
        await firebase.requestPermission();
      } catch (err) {
        console.error("🚫 Không thể cấp quyền thông báo.", err);
      }
    };

    requestPermission();
  }, [firebase]);
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
    // layout cho trang login/register/404
    return <main className="w-full h-screen">{children}</main>;
  }

  // Layout chính của app chat
  return (
    <div className="flex h-screen w-full bg-slate-900 text-foreground">
      <nav className="relative h-full">
        <Suspense fallback={<div className="w-[60px] h-full" />}>
          <Header />
        </Suspense>
      </nav>
      <main className="flex-1 h-screen flex overflow-hidden">
        {/* Global socket listener / toasts / events */}

        {!isDisableLeftSide && 
        (
          <>
            <div
              ref={sidebarRef}
              className="relative h-full shrink-0"
              style={{ width: `${sidebarWidth}px` }}
            >
              <div className="absolute top-3 right-3 z-20">{collapseButton}</div>
              <Suspense fallback={<div className="h-full" />}>
                <LeftSide />
              </Suspense>
              <div
                role="separator"
                aria-orientation="vertical"
                tabIndex={0}
                className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors ${
                  isResizing
                    ? "bg-primary/40"
                    : "bg-transparent hover:bg-primary/20"
                }`}
                onPointerDown={handleResizeStart}
              />
            </div>
          </>
        )}

        <div className="flex-1 overflow-y-auto h-screen">{children}</div>
      </main>
    </div>
  );
}
