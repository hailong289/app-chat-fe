"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import { ChevronDoubleDownIcon } from "@heroicons/react/16/solid";
import { Avatar, Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

export const ChatMessages = ({ chatId }: { chatId: string }) => {
  //

  const messageState = useMessageStore((state) => state);
  const messages = messageState.messagesRoom[chatId]?.messages || [];
  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const [isTopVisible, setIsTopVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  //  xử lý cuộn
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // local state
  useEffect(() => {
    const lastMessageId = messageState.messagesRoom[chatId]?.last_message_id;
    if (lastMessageId) {
      scrollToMessage(lastMessageId);
    }
  }, [chatId]);
  // Observer cho bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          console.log("🎯 Đã chạm đáy div!");
          // gọi API load thêm data ở đây
          setIsBottomVisible(true);
        } else {
          setIsBottomVisible(false);
        }
      },
      { threshold: 1 }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  // Observer cho top
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          console.log("🔝 Đã chạm đỉnh div!");
          // gọi API load tin nhắn cũ hơn ở đây
          setIsTopVisible(true);
        } else {
          setIsTopVisible(false);
        }
      },
      { threshold: 1 }
    );

    if (topRef.current) observer.observe(topRef.current);
    return () => observer.disconnect();
  }, []);

  /** 🎯 Khi có tin nhắn mới → cuộn xuống nếu đang ở gần đáy */
  useEffect(() => {
    if (isBottomVisible && messages.length > 0) {
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
    stickyBottomPx: 60, // chiều cao sticky dưới (nếu có)
    minVisibleRatio: 0.5, // thấy >=50% coi như đã đọc
    onCommit: (id: string) => {
      console.log("Đã đọc tới:", id);
    }, // debounce 180ms
  });
  return (
    <div
      ref={containerRef}
      className="p-4 space-y-4 overflow-y-auto w-full max-h-[calc(100vh-180px)] min-h-[200px]"
    >
      <div ref={topRef} />
      {messages.map((msg) => (
        <div
          key={msg.id}
          ref={setMessageRef(msg.id)}
          className={`flex ${msg.isMine ? "justify-end" : "justify-start"}`}
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
          <div
            className={`bg-${msg.isMine ? "primary" : "white"} text-${
              msg.isMine ? "white" : "black"
            } p-3 rounded-lg shadow max-w-xs`}
          >
            {/* Hiển thị nội dung tin nhắn */}
            {msg.content && <p>{msg.content}</p>}

            {/* Hiển thị attachments nếu có */}
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {msg.attachments.map((attachment, idx) => {
                  const isImage = attachment.kind === "photo";
                  const isVideo = attachment.kind === "video";
                  const isAudio = attachment.kind === "audio";

                  return (
                    <div key={attachment._id || idx}>
                      {isImage && (
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="rounded-lg max-w-full h-auto cursor-pointer"
                          onClick={() => window.open(attachment.url, "_blank")}
                        />
                      )}
                      {isVideo && (
                        <video
                          src={attachment.url}
                          controls
                          className="rounded-lg max-w-full h-auto"
                        >
                          <track kind="captions" />
                        </video>
                      )}
                      {isAudio && (
                        <audio src={attachment.url} controls className="w-full">
                          <track kind="captions" />
                        </audio>
                      )}
                      {!isImage && !isVideo && !isAudio && (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          <span className="text-2xl">📎</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {attachment.name}
                            </p>
                            {attachment.size && (
                              <p className="text-xs text-gray-500">
                                {(attachment.size / 1024).toFixed(1)} KB
                              </p>
                            )}
                          </div>
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {msg.isMine && (
            <Avatar
              src={msg.sender.avatar || undefined}
              name={msg.sender.fullname || "User"}
              size="sm"
              className="w-8 h-8 mr-2"
            />
          )}
        </div>
      ))}
      <div ref={bottomRef} />
      <div className="sticky bottom-5 float-right  h-10 w-full">
        {lastReadId}
      </div>
      {!isBottomVisible && (
        // <button
        //   style={{
        //     position: "sticky",
        //     bottom: 10,
        //     float: "right",
        //     background: "#0078ff",
        //     color: "#fff",
        //     border: "none",
        //     borderRadius: 16,
        //     padding: "6px 12px",
        //     cursor: "pointer",
        //   }}
        //   onClick={scrollToBottom}
        // >
        //   ⬇️ Cuộn xuống
        // </button>

        <Button
          className="sticky bottom-10 float-right"
          onPress={scrollToBottom}
          color="secondary"
        >
          <ChevronDoubleDownIcon className="w-5 h-5" />
        </Button>
      )}
    </div>
  );
};

// ...existing code...
