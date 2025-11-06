"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import { ChevronDoubleDownIcon } from "@heroicons/react/16/solid";
import { Avatar, Button, Image, ScrollShadow } from "@heroui/react";
import { useEffect, useRef, useState, useMemo, use } from "react";
import {
  groupMessagesByDate,
  formatMessageTime,
} from "@/libs/timeline-helpers";
import { CompactFileGallery } from "../CompactFileGallery";
import useRoomStore from "@/store/useRoomStore";
import { useSocket } from "../providers/SocketProvider";

export const ChatMessages = ({ chatId }: { chatId: string }) => {
  //
  const { socket } = useSocket();
  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);
  const messages = messageState.messagesRoom[chatId]?.messages || [];
  const lastMsgId = roomState.readedRooms[chatId] || "null";

  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const [isTopVisible, setIsTopVisible] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  //  xử lý cuộn
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  //

  useEffect(() => {
    setIsBottomVisible(false);
    scrollToMessage(lastMsgId);
  }, [chatId]);

  // Group messages by date for timeline display
  const messageGroups = useMemo(() => {
    return groupMessagesByDate(messages);
  }, [messages]);

  // Observer cho bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && messages.length > 0) {
          console.log("🎯 Đã chạm đáy div!");
          // gọi API load thêm data ở đây
          setIsBottomVisible(true);
        } else {
          setIsBottomVisible(false);
        }
      },
      {
        root: containerRef.current, // Quan trọng: phải set root là container
        threshold: 0.1, // Giảm threshold để dễ trigger hơn
      }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [messages]); // Thêm messages để re-observe khi có tin mới

  // Observer cho top
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Kiểm tra xem container có thanh cuộn hay không
          const container = containerRef.current;
          const hasScroll =
            container && container.scrollHeight > container.clientHeight;

          if (hasScroll) {
            console.log("🔝 Đã chạm đỉnh div!");
            // gọi API load tin nhắn cũ hơn ở đây
            setIsTopVisible(true);
          } else {
            console.log("⚠️ Chưa có thanh cuộn, không load thêm");
            setIsTopVisible(false);
          }
        } else {
          setIsTopVisible(false);
        }
      },
      { threshold: 1 }
    );

    if (topRef.current) observer.observe(topRef.current);
    return () => observer.disconnect();
  }, []);

  // Thêm scroll listener để kiểm tra khi đến đáy
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight <= 20; // 20px threshold

      if (isAtBottom !== isBottomVisible) {
        console.log("🎯 Scroll đến đáy:", isAtBottom);
        setIsBottomVisible(isAtBottom);
      }
    };

    container.addEventListener("scroll", handleScroll);
    // Check initial state
    handleScroll();

    return () => container.removeEventListener("scroll", handleScroll);
  }, [isBottomVisible]);

  /** 🎯 Khi có tin nhắn mới → cuộn xuống nếu đang ở gần đáy */
  useEffect(() => {
    if (isBottomVisible) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  /** 🎯 Điều hướng cuộn: scrollToTop, scrollToBottom, scrollToId */
  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToMessage = (id: string) => {
    const el = document.querySelector(`[data-mid="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const { setMessageRef, lastReadId } = useReadProgress({
    messages, // ASC time
    container: containerRef.current, // nếu scroll trong div
    stickyBottomPx: 20, // chiều cao sticky dưới (nếu có)
    minVisibleRatio: 0.5, // thấy >=50% coi như đã đọc
    onCommit: (id: string) => {
      console.log("🚀 ~ ChatMessages ~ id:", id);
      if (id > lastMsgId) {
        console.log("Đã đọc tới:", id);
      }
    }, // debounce 180ms
  });
  useEffect(() => {
    console.log("🚀 ~ ChatMessages ~ lastReadId:", lastMsgId > lastReadId);
    console.log("🚀 ~ ChatMessages ~ lastReadId:", lastReadId);
    console.log("🚀 ~ ChatMessages ~ lastMsgId:", roomState.readedRooms);
    // if (lastReadId > roomState.readedRooms[chatId]) {
    //   console.log("🚀 ~ ChatMessages:", lastReadId > roomState.readedRooms[chatId]);
    //   // messageState.markMessageAsRead(chatId, lastReadId, socket);
    // }
  }, [lastReadId]);
  return (
    <ScrollShadow
      ref={containerRef}
      className="px-4  overflow-y-auto w-full max-h-[calc(100vh-180px)]"
    >
      <div ref={topRef} />

      {/* Timeline grouping */}
      {messageGroups.length === 0 && (
        <div className="text-center text-gray-500 mt-10">
          Chưa có tin nhắn nào. Bắt đầu trò chuyện thôi!
        </div>
      )}
      {messageGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-4">
          {/* Date divider */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
              {group.dateLabel}
            </div>
          </div>

          {/* Messages in this date group */}
          {group.messages.map((msg) => (
            <div
              key={msg.id}
              ref={setMessageRef(msg.id)}
              className={`flex items-end ${
                msg.isMine ? "justify-end" : "justify-start"
              }`}
              data-mid={msg.id} // 🔴 bắt buộc để hook đọc id
            >
              {!msg.isMine && (
                <Avatar
                  src={msg.sender.avatar || undefined}
                  name={msg.sender.fullname || "User"}
                  size="sm"
                  className="w-8 h-8 mr-2"
                />
              )}
              <div className="flex flex-col max-w-xs">
                {/* Hiển thị attachments với gallery */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <CompactFileGallery
                    files={msg.attachments}
                    maxDisplay={4}
                    className="max-w-full"
                  />
                )}
                <div
                  className={`bg-${msg.isMine ? "primary" : "white"} text-${
                    msg.isMine ? "white" : "black"
                  } p-3 rounded-lg shadow`}
                >
                  {/* Hiển thị nội dung tin nhắn */}
                  {msg.content && <p className="mb-2">{msg.content}</p>}
                </div>
                {/* Timestamp */}
                <span
                  className={`text-xs text-gray-500 mt-1 ${
                    msg.isMine ? "text-right" : "text-left"
                  }`}
                >
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
              {msg.isMine && (
                <Avatar
                  src={msg.sender.avatar || undefined}
                  name={msg.sender.fullname || "User"}
                  size="sm"
                  className="w-8 h-8 ml-2"
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Bottom marker với height để dễ detect */}
      <div ref={bottomRef} className="h-1 w-full" />

      <div className="sticky bottom-5 float-right  h-10 w-full">
        {lastReadId}
      </div>
      {!isBottomVisible && containerRef.current && (
        <Button
          className="sticky bottom-10 float-right"
          onPress={scrollToBottom}
          color="secondary"
        >
          <ChevronDoubleDownIcon className="w-5 h-5" />
        </Button>
      )}
    </ScrollShadow>
  );
};

// ...existing code...
