"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Home } from "../left-page/home";
import Messages from "../left-page/messages";
import Contacts from "../left-page/contact";
import Notification from "../left-page/notification";
import Document from "../left-page/document";
import Settings from "../left-page/settings";
import useCounterStore from "@/store/useCounterStore";

export const LeftSide = () => {
  const countState = useCounterStore((state) => state);
  const searchParams = useSearchParams();
  const path = usePathname();
  const navigation = useRouter();
  const tab =
    searchParams.get("tab") || (path === "/" ? "home" : countState.tab);

  // Handle navigation to /docs when documents tab is selected
  useEffect(() => {
    if (tab === "documents") {
      navigation.push("/docs");
    }
  }, [tab, navigation]);

  return (
    <div className="bg-white h-screen flex flex-col border-r border-default dark:bg-slate-900 dark:border-slate-700overflow-y-auto">
      {/* Render different components based on the tab */}
      {path.includes("/settings") && !searchParams.get("tab") ? (
        <Settings />
      ) : (
        <>
          {tab === "home" && <Home />}
          {tab === "messages" && <Messages />}
          {tab === "contacts" && <Contacts />}
          {tab === "notifications" && <Notification />}
          {tab === "documents" && <Document />}
          {tab === "settings" && <Settings />}
        </>
      )}
    </div>
  );
};
