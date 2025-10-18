"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Home } from "../left-page/home";
import Messages from "../left-page/messages";
import Contacts from "../left-page/contact";
import Notification from "../left-page/notification";
import Document from "../left-page/document";
import Settings from "../left-page/settings";

export const LeftSide = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const path = usePathname();
  const tab = searchParams.get("tab") || "home";
  return (
    <div className="bg-white h-screen flex flex-col w-4/12">
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
