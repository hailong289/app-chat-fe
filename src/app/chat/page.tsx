"use client";

import ChatHeader from "@/components/chat/header";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
  MicrophoneIcon,
  Bars3Icon,
  FaceSmileIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@heroui/react";
import { useEffect, useState } from "react";
import useRoomStore from "@/store/useRoomStore";
import { useSearchParams } from "next/navigation";
import ChatInputBar from "@/components/chat/inputBar";
import { ChatMessages } from "@/components/chat/ChatMessages";
// import { useRouter } from "next/router";

export default function ChatPage() {
  const [widthClass, setWidthClass] = useState("w-full");
  const callbackSetSize = () => {
    if (widthClass === "w-full") {
      setWidthClass("w-[calc(100%-400px)]");
    } else {
      setWidthClass("w-full");
    }
  };
  const roomState = useRoomStore((state) => state);
  const searchParams = useSearchParams();
  const [room, setRoom] = useState<any>(undefined);
  const chatId = searchParams.get("chatId") || "";
  const isLoading = useRoomStore((s) => s.isLoading);
  console.log("Chat ID:", chatId);
  useEffect(() => {
    roomState.getRoomById(chatId);
  }, [chatId]);
  return (
    <div className={`bg-light h-screen ${widthClass}`}>
      <ChatHeader callback={callbackSetSize} />
      <main className="w-full h-[calc(100vh-80px)] relative">
        {/* Chat messages would go here */}
        <ChatMessages chatId={chatId} />
        {/* Message input area */}
        <ChatInputBar chatId={chatId} />
      </main>
    </div>
  );
}
