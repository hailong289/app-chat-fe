import { useCallback, useRef, useEffect } from "react";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { MessageType } from "@/store/types/message.state";
import { useToastStore } from "@/store/useToastStore";

interface UseChatScrollProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  displayedMessagesCount: number;
  messages: any[];
  chatId: string;
  messageState: any;
  setDisplayedMessagesCount: (
    count: number | ((prev: number) => number)
  ) => void;
  setIsLoadingOlder: (loading: boolean) => void;
  setHasMoreOnServer: (hasMore: boolean) => void;
}

export function useChatScroll({
  containerRef,
  bottomRef,
  displayedMessagesCount,
  messages,
  chatId,
  messageState,
  setDisplayedMessagesCount,
  setIsLoadingOlder,
  setHasMoreOnServer,
}: UseChatScrollProps) {
  const { addToast } = useToastStore();
  const isUserInteracting = useRef(false);

  // Detect user interaction to stop auto-scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleUserInteraction = () => {
      isUserInteracting.current = true;
    };

    container.addEventListener("wheel", handleUserInteraction, {
      passive: true,
    });
    container.addEventListener("touchmove", handleUserInteraction, {
      passive: true,
    });
    container.addEventListener("mousedown", handleUserInteraction, {
      passive: true,
    });
    container.addEventListener("keydown", handleUserInteraction, {
      passive: true,
    });

    return () => {
      container.removeEventListener("wheel", handleUserInteraction);
      container.removeEventListener("touchmove", handleUserInteraction);
      container.removeEventListener("mousedown", handleUserInteraction);
      container.removeEventListener("keydown", handleUserInteraction);
    };
  }, [containerRef]);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [containerRef]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [containerRef, bottomRef]);

  const scrollToMessage = useCallback(
    async (id: string) => {
      // Reset interaction flag
      isUserInteracting.current = false;

      // Helper function để highlight message
      const highlightMessage = (element: Element) => {
        element.classList.add("message-highlight-flash");
        setTimeout(() => {
          element.classList.remove("message-highlight-flash");
        }, 1000);
      };

      // Kiểm tra element đã tồn tại chưa
      const el = document.querySelector(`[data-mid="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => highlightMessage(el), 500);
        return;
      }

      // Element chưa render - tìm index trong messages
      let messageIndex = messages.findIndex((msg) => msg.id === id);

      // CASE 1: Tin nhắn chưa có trong local → load từ server
      if (messageIndex === -1) {
        if (containerRef.current) {
          containerRef.current.scrollTop = 0;
        }

        setIsLoadingOlder(true);
        addToast({
          type: "info",
          message: "Đang tìm tin nhắn cũ...",
          duration: 3000,
        });

        try {
          let attempts = 0;
          const MAX_ATTEMPTS = 5;

          while (attempts < MAX_ATTEMPTS) {
            // Stop if user interacted
            if (isUserInteracting.current) {
              setIsLoadingOlder(false);
              return;
            }

            const result = await messageState.loadOlderMessages(chatId, 100);

            if (!result || (Array.isArray(result) && result.length === 0)) {
              setIsLoadingOlder(false);
              setHasMoreOnServer(false);
              addToast({
                type: "error",
                message: "Không tìm thấy tin nhắn",
              });
              return;
            }

            const currentMessages =
              messageState.messagesRoom[chatId]?.messages || [];
            messageIndex = currentMessages.findIndex(
              (msg: MessageType) => msg.id === id
            );

            if (messageIndex !== -1) {
              break;
            }

            attempts++;
            addToast({
              type: "info",
              message: `Đang tải thêm tin nhắn... (${attempts}/${MAX_ATTEMPTS})`,
              duration: 2000,
            });
          }

          setIsLoadingOlder(false);

          if (messageIndex === -1) {
            addToast({
              type: "error",
              message: "Không tìm thấy tin nhắn sau khi tải thêm",
            });
            return;
          }
        } catch (error) {
          setIsLoadingOlder(false);
          addToast({
            type: "error",
            message: "Lỗi khi tải tin nhắn",
          });
          return;
        }
      }

      // CASE 2: Tin nhắn có trong local nhưng chưa render
      const currentMessages =
        messageState.messagesRoom[chatId]?.messages || messages;

      // Fix: Calculate required count based on distance from end (since we slice from end)
      const messagesFromEnd = currentMessages.length - messageIndex;
      const requiredCount = messagesFromEnd + MESSAGES_PER_GROUP;

      if (requiredCount > displayedMessagesCount) {
        // Warn user if scrolling too far back
        if (messagesFromEnd > 1000) {
          addToast({
            type: "warning",
            message: "Đang tải số lượng lớn tin nhắn, vui lòng chờ...",
            duration: 4000,
          });
        }

        const currentScrollTop = containerRef.current?.scrollTop || 0;
        const currentScrollHeight = containerRef.current?.scrollHeight || 0;

        setDisplayedMessagesCount(
          Math.min(requiredCount, currentMessages.length)
        );

        const waitForElementAndScroll = (retries = 20, delay = 50) => {
          if (isUserInteracting.current) return;

          requestAnimationFrame(() => {
            const newEl = document.querySelector(`[data-mid="${id}"]`);
            // Ensure element is rendered and has dimensions
            if (newEl && newEl.getBoundingClientRect().height > 0) {
              if (containerRef.current) {
                const newScrollHeight = containerRef.current.scrollHeight || 0;
                const scrollDiff = newScrollHeight - currentScrollHeight;
                // Only adjust if content was added above
                if (scrollDiff > 0) {
                  containerRef.current.scrollTop =
                    currentScrollTop + scrollDiff;
                }
              }

              // Small delay to let the scrollTop adjustment settle
              setTimeout(() => {
                if (isUserInteracting.current) return;
                newEl.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => highlightMessage(newEl), 500);
              }, 50);
            } else if (retries > 0) {
              setTimeout(
                () => waitForElementAndScroll(retries - 1, delay),
                delay
              );
            }
          });
        };

        waitForElementAndScroll();
      } else {
        const scrollToExisting = (retries = 10) => {
          if (isUserInteracting.current) return;

          requestAnimationFrame(() => {
            const targetEl = document.querySelector(`[data-mid="${id}"]`);
            if (targetEl && targetEl.getBoundingClientRect().height > 0) {
              targetEl.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
              setTimeout(() => highlightMessage(targetEl), 500);
            } else if (retries > 0) {
              setTimeout(() => scrollToExisting(retries - 1), 100);
            }
          });
        };

        scrollToExisting();
      }
    },
    [
      messages,
      displayedMessagesCount,
      MESSAGES_PER_GROUP,
      chatId,
      messageState,
      containerRef,
      setIsLoadingOlder,
      setHasMoreOnServer,
      setDisplayedMessagesCount,
    ]
  );

  return {
    scrollToTop,
    scrollToBottom,
    scrollToMessage,
  };
}
