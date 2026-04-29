"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import useRoomStore from "@/store/useRoomStore";
import { ChatPageContent } from "@/components/chat/ChatPageContent";

export default function Page() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Subscribe to the active room. Sidebar click → useRoomStore.setState({ room })
  // re-renders this component in the same tick, so we swap from the
  // welcome screen to the chat layout WITHOUT a Next.js navigation
  // (no router.push, no /chat route mount). Room remains in the store
  // for /chat as well, so deep-linking still works.
  const room = useRoomStore((state) => state.room);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (room) return <ChatPageContent />;

  return (
    <div className="w-full h-screen flex items-center justify-center bg-light">
      <div className="text-center max-w-2xl px-8">
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/logo.png" alt="Chat Icon" width={100} height={100} />
          </div>
          <h1
            suppressHydrationWarning
            className="text-4xl font-bold text-gray-800 mb-4"
          >
            {t("home.welcome")}
          </h1>
          <p suppressHydrationWarning className="text-lg text-gray-600 mb-6">
            {t("home.description")}
          </p>
        </div>
      </div>
    </div>
  );
}
