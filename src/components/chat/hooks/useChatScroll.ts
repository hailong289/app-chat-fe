import { useCallback, useRef, useEffect } from "react";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { MessageType } from "@/store/types/message.state";
import { useToastStore } from "@/store/useToastStore";
import useMessageStore from "@/store/useMessageStore";

interface UseChatScrollProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  displayedMessagesCount: number;
  messages: any[];
  chatId: string;
  messageState: any;
  setDisplayedMessagesCount: (
    count: number | ((prev: number) => number),
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
      if (!id || id === "null" || id === "undefined") {
        console.warn("scrollToMessage called with invalid ID:", id);
        return;
      }

      // Reset interaction flag
      isUserInteracting.current = false;

      // Helper function để highlight message
      const highlightMessage = (element: Element) => {
        element.classList.add("message-highlight-flash");
        setTimeout(() => {
          element.classList.remove("message-highlight-flash");
        }, 1000);
      };

      // 1. Check DOM (Rendered?)
      const el = document.querySelector(`[data-mid="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => highlightMessage(el), 500);
        return;
      }

      // 2. Check State (Loaded but not rendered?)
      let messageIndex = messages.findIndex((msg) => msg.id === id);

      // 3. If not in state, try to find it (DB -> API)
      if (messageIndex === -1) {
        setIsLoadingOlder(true);
        addToast({
          type: "info",
          message: "Đang tìm tin nhắn...",
          duration: 2000,
        });

        try {
          // Use findMessage from store (checks DB then API)
          const found = await messageState.findMessage(chatId, id);

          if (!found) {
            setIsLoadingOlder(false);
            setHasMoreOnServer(false);
            addToast({
              type: "error",
              message: "Không tìm thấy tin nhắn",
            });
            return;
          }

          // Get fresh messages from store (flatten groups)
          const roomData = useMessageStore.getState().messagesRoom[chatId];
          const currentMessages =
            roomData?.groups?.flatMap((g) => g.messages) || [];
          messageIndex = currentMessages.findIndex(
            (msg: MessageType) => msg.id === id,
          );

          if (messageIndex === -1) {
            setIsLoadingOlder(false);
            addToast({
              type: "error",
              message: "Lỗi hiển thị tin nhắn",
            });
            return;
          }

          setIsLoadingOlder(false);
        } catch (error) {
          setIsLoadingOlder(false);
          addToast({
            type: "error",
            message: "Lỗi khi tìm tin nhắn",
          });
          return;
        }
      }

      // 4. Render and Scroll
      // At this point, message is in state (either initially or after fetch)
      // We need to ensure it's within displayedMessagesCount

      // Get fresh messages from store (flatten groups)
      const roomData = useMessageStore.getState().messagesRoom[chatId];
      const currentMessages =
        roomData?.groups?.flatMap((g) => g.messages) || messages;

      // Recalculate index in case it changed
      messageIndex = currentMessages.findIndex(
        (msg: MessageType) => msg.id === id,
      );

      if (messageIndex === -1) return; // Should not happen

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
          Math.min(requiredCount, currentMessages.length),
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
                delay,
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
      addToast,
    ],
  );

  return {
    scrollToTop,
    scrollToBottom,
    scrollToMessage,
  };
}
