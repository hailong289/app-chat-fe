import { useCallback, useRef } from "react";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { MessageType } from "@/store/types/message.state";

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

        try {
          let attempts = 0;
          const MAX_ATTEMPTS = 5;

          while (attempts < MAX_ATTEMPTS) {
            const result = await messageState.loadOlderMessages(chatId, 100);

            if (!result || (Array.isArray(result) && result.length === 0)) {
              setIsLoadingOlder(false);
              setHasMoreOnServer(false);
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
          }

          setIsLoadingOlder(false);

          if (messageIndex === -1) {
            return;
          }
        } catch (error) {
          setIsLoadingOlder(false);
          return;
        }
      }

      // CASE 2: Tin nhắn có trong local nhưng chưa render
      const currentMessages =
        messageState.messagesRoom[chatId]?.messages || messages;

      const requiredCount = messageIndex + 1 + MESSAGES_PER_GROUP;

      if (requiredCount > displayedMessagesCount) {
        const currentScrollTop = containerRef.current?.scrollTop || 0;
        const currentScrollHeight = containerRef.current?.scrollHeight || 0;

        setDisplayedMessagesCount(
          Math.min(requiredCount, currentMessages.length)
        );

        const waitForElementAndScroll = (retries = 5, delay = 100) => {
          requestAnimationFrame(() => {
            const newEl = document.querySelector(`[data-mid="${id}"]`);
            if (newEl) {
              if (containerRef.current) {
                const newScrollHeight = containerRef.current.scrollHeight || 0;
                const scrollDiff = newScrollHeight - currentScrollHeight;
                containerRef.current.scrollTop = currentScrollTop + scrollDiff;
              }

              setTimeout(() => {
                newEl.scrollIntoView({ behavior: "smooth", block: "center" });
                setTimeout(() => highlightMessage(newEl), 500);
              }, 100);
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
        const scrollToExisting = (retries = 3) => {
          requestAnimationFrame(() => {
            const targetEl = document.querySelector(`[data-mid="${id}"]`);
            if (targetEl) {
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
