"use client";

import ChatHeader from "@/components/chat/header";
import { useEffect, useState, Suspense } from "react";
import useRoomStore from "@/store/useRoomStore";
import { useSearchParams } from "next/navigation";
import ChatInputBar from "@/components/chat/input/inputBar";
import useAuthStore from "@/store/useAuthStore";
import { ChatMessages } from "@/components/chat/message/ChatMessages";
import { Skeleton } from "@heroui/react";

function ChatPageContent() {
  const [widthClass, setWidthClass] = useState("w-full");
  const callbackSetSize = () => {
    if (widthClass === "w-full") {
      setWidthClass("w-[calc(100%-400px)]");
    } else {
      setWidthClass("w-full");
    }
  };

  const roomState = useRoomStore((state) => state);
  const authState = useAuthStore((state) => state);
  const searchParams = useSearchParams();
  const [chatId, setChatId] = useState<string>("");
  const [noAction, setNoAction] = useState<boolean>(false);
  const [scrollto, setScrollto] = useState<string | null>(null);
  const [toggleInput, setToggleInput] = useState<boolean>(false);

  useEffect(() => {
    if (roomState.room?.id) {
      setChatId(roomState.room.id);
    } else {
      const id = searchParams.get("chatId") || "";
      setChatId(id);
      roomState.getRoomById(id);
    }

    const user = roomState.room?.members.find(
      (m) => m.id == authState.user?.id
    );
    setNoAction(user?.role === "guest");

    if (roomState.room?.name) {
      document.title = `${roomState.room.name} - Nhắn tin - Ichat`;
    } else {
      document.title = "Nhắn tin - Ichat";
    }
  }, [roomState.room, authState.user, searchParams, roomState]);

  return (
    <div
      className={`
        h-screen ${widthClass}
        bg-light 
        dark:bg-slate-900
        flex flex-col
      `}
    >
      <ChatHeader
        callback={callbackSetSize}
        noAction={noAction}
        setScrollto={setScrollto}
      />
      <main className="w-full flex-1 relative overflow-hidden dark:bg-slate-900">
        <ChatMessages
          chatId={chatId}
          noAction={noAction}
          scrollto={scrollto}
          toggleInput={toggleInput}
        />

        <ChatInputBar
          chatId={chatId}
          noAction={noAction}
          setToggleInput={setToggleInput}
          toggleInput={toggleInput}
          setScrollto={setScrollto}
        />
      </main>
    </div>
  );
}

export default function ChatPage() {
  const Fallback = (
    <div className="h-screen w-full flex items-center justify-center bg-light dark:bg-slate-900">
      <div className="w-full max-w-3xl px-6 space-y-6">
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-1/3 rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="flex-1 space-y-3 max-w-md">
              <Skeleton className="h-3 w-1/4 rounded-md ml-auto" />
              <Skeleton className="h-4 w-full rounded-lg" />
              <Skeleton className="h-4 w-5/6 rounded-lg" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );

  return (
    <Suspense
      fallback={Fallback}
    >
      <ChatPageContent />
    </Suspense>
  );
}
