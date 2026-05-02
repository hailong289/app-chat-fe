"use client";

import ChatHeader from "@/components/chat/header";
import { useEffect, useState, useCallback } from "react";
import useRoomStore from "@/store/useRoomStore";
import ChatInputBar from "@/components/chat/input/inputBar";
import useAuthStore from "@/store/useAuthStore";
import { ChatMessages } from "@/components/chat/message/ChatMessages";
import { ChatBubbleLeftRightIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

/**
 * The actual chat UI — header, message list, input bar — driven entirely
 * by `useRoomStore.room`. Lives outside of any specific page so both the
 * `/chat` route and the dashboard (`/`) can render it: dashboard shows
 * the welcome screen until a room is picked, then swaps to this without
 * a Next.js navigation (instant, store-driven).
 *
 * Mobile behavior:
 * - Khi có room: component chiếm full-screen, ẩn LeftSide qua parent CSS.
 * - Nút Back (Back Bar) ở trên cùng: bấm để clear room → quay về danh sách.
 */
export function ChatPageContent() {
  const { t } = useTranslation();
  const [widthClass, setWidthClass] = useState("w-full");
  const callbackSetSize = () => {
    if (widthClass === "w-full") {
      setWidthClass("w-[calc(100%-400px)]");
    } else {
      setWidthClass("w-full");
    }
  };

  const room = useRoomStore((state) => state.room);
  const user = useAuthStore((state) => state.user);
  const [noAction, setNoAction] = useState<boolean>(false);
  const [scrollto, setScrollto] = useState<string | null>(null);
  const [toggleInput, setToggleInput] = useState<boolean>(false);

  const chatId = room?.id ?? "";
  const hasRoomSelected = !!room;

  useEffect(() => {
    const member = room?.members.find((m) => m.id == user?.id);
    setNoAction(member?.role === "guest");
    document.title = room?.name
      ? `${room.name} - Nhắn tin - Ichat`
      : "Nhắn tin - Ichat";
  }, [room, user]);

  // Mobile Back: xóa room khỏi store → LeftSide tự hiện lại nhờ CSS
  const handleMobileBack = useCallback(() => {
    useRoomStore.setState({ room: null });
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/chat");
    }
  }, []);

  return (
    <div
      className={`
        h-screen ${widthClass}
        bg-light
        dark:bg-slate-900
        flex flex-col
      `}
    >
      {hasRoomSelected ? (
        <>
          {/* Mobile Back Bar — chỉ hiện trên mobile (<md), nằm trên ChatHeader */}
          <div className="md:hidden flex items-center gap-2 px-3 py-2 bg-primary dark:bg-slate-800 text-white shrink-0">
            <button
              type="button"
              onClick={handleMobileBack}
              className="flex items-center gap-1.5 text-white active:opacity-70 transition-opacity"
              aria-label="Quay lại danh sách"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span className="text-sm font-medium">{t("chat.backToList", "Danh sách")}</span>
            </button>
          </div>

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
        </>
      ) : (
        <main className="w-full flex-1 flex items-center justify-center dark:bg-slate-900">
          <div className="text-center text-gray-500 dark:text-gray-400 px-6">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <ChatBubbleLeftRightIcon className="w-10 h-10 text-gray-400 dark:text-gray-300" />
            </div>
            <p
              suppressHydrationWarning
              className="text-lg font-medium text-gray-700 dark:text-gray-200"
            >
              {t("chat.noRoomSelected.title", "Chọn một cuộc trò chuyện")}
            </p>
            <p suppressHydrationWarning className="text-sm mt-1">
              {t(
                "chat.noRoomSelected.subtitle",
                "Chọn từ danh sách bên trái để bắt đầu nhắn tin",
              )}
            </p>
          </div>
        </main>
      )}
    </div>
  );
}
