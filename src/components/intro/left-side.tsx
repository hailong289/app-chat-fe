"use client";

import { usePathname } from "next/navigation";
import { Home } from "../left-page/home";
import Contacts from "../left-page/contact";
import Document from "../left-page/document";
import Settings from "../left-page/settings";
import useCounterStore from "@/store/useCounterStore";

/**
 * Render the left-side panel based purely on the URL path. No more
 * `?tab=...` query — every nav button in <Header /> navigates to its own
 * route, which keeps deep-links / refresh / back-navigation consistent.
 */
export const LeftSide = () => {
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);
  const pathname = usePathname();

  const renderPanel = () => {
    if (pathname === "/" || pathname.startsWith("/chat")) return <Home />;
    if (pathname.startsWith("/contacts")) return <Contacts />;
    if (pathname.startsWith("/docs")) return <Document />;
    if (pathname.startsWith("/settings")) return <Settings />;
    // /flash-card, /todo, /call render their full page on the right side
    // and don't have a dedicated left-side panel — leave the area empty.
    return null;
  };

  return (
    <div
      className={`bg-white h-screen flex flex-col border-r border-default dark:bg-slate-900 dark:border-slate-700 overflow-y-auto transition-all duration-200 ${
        isCollapsed ? "items-center gap-4 py-4" : ""
      }`}
    >
      {renderPanel()}
    </div>
  );
};
