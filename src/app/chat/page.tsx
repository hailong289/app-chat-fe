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
        <div className="p-4 space-y-4 overflow-y-auto h-full">
          {/* Example message */}
          <div className="flex justify-start">
            <Avatar
              src="https://avatar.iran.liara.run/public"
              name="Rohini Sharma"
              size="sm"
              className="w-8 h-8 mr-2"
            />
            <div className="bg-white p-3 rounded-lg shadow max-w-xs">
              Hello! How are you?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-primary text-white p-3 rounded-lg shadow max-w-xs">
              I'm good, thanks! And you?
            </div>
            <Avatar
              src="https://avatar.iran.liara.run/public"
              name="You"
              size="sm"
              className="w-8 h-8 ml-2"
            />
          </div>
          {/* More messages... */}
        </div>

        {/* Message input area */}
        <ChatInputBar />
      </main>
    </div>
  );
}
