"use client";

import ChatHeader from "@/components/chat/header";
import { useEffect, useState, Suspense } from "react";
import useRoomStore from "@/store/useRoomStore";
import { useSearchParams } from "next/navigation";
import ChatInputBar from "@/components/chat/input/inputBar";
import useAuthStore from "@/store/useAuthStore";
import { ChatMessages } from "@/components/chat/message/ChatMessages";

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
    if (!roomState.room?.id) {
      const id = searchParams.get("chatId") || "";
      setChatId(id);
      roomState.getRoomById(id);
    } else {
      setChatId(roomState.room.id);
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
      `}
    >
      <ChatHeader
        callback={callbackSetSize}
        noAction={noAction}
        setScrollto={setScrollto}
      />
      <main className="w-full h-[calc(100vh-80px)] relative overflow-hidden dark:bg-slate-900">
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
  return (
    <Suspense
      fallback={
        <div
          className="
            h-screen w-full flex items-center justify-center
            bg-light dark:bg-slate-900
          "
        >
          <p className="text-gray-500 dark:text-gray-400">
            Đang tải cuộc trò chuyện...
          </p>
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
