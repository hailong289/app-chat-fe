import { useEffect, useMemo } from "react";
// import { groupMessagesByDate } from "@/libs/timeline-helpers"; // Removed: Filter logic moved to store
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { useTranslation } from "react-i18next";
import { MessageGroup } from "@/store/types/message.state"; // Import type
import useAuthStore from "@/store/useAuthStore";

interface UseChatMessagesEffectsProps {
  chatId: string;
  groups: MessageGroup[]; // Changed from messages array
  lastReadId: string | null;
  scrollTargetId: string;
  lastServerMessageId: string | null;
  displayedMessagesCount: number;
  isSwitchingChat: boolean;
  isBottomVisible: boolean;
  isLoadingOlder: boolean;
  hasMoreLocalMessages: boolean;
  hasLoadedAllLocal: boolean;
  isLoadingFromAPI: boolean;
  hasMoreOnServer: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  prevMessageCountRef: React.MutableRefObject<number>;
  prevChatIdRef: React.MutableRefObject<string>;
  renderedMessageIds: React.MutableRefObject<Set<string>>;
  loadingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  hasTriedLoadingFromServer: React.MutableRefObject<boolean>;
  fetchTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  lastFetchedServerMessageIdRef: React.MutableRefObject<string | null>;
  hasInitialFetchRef: React.MutableRefObject<Record<string, boolean>>;
  messageState: any;
  socket: any;
  setIsSwitchingChat: (value: boolean) => void;
  setShouldAnimate: (value: boolean) => void;
  setDisplayedMessagesCount: (
    count: number | ((prev: number) => number)
  ) => void;
  setHasMoreOnServer: (value: boolean) => void;
  setExpandedMessages: (
    value: Set<string> | ((prev: Set<string>) => Set<string>)
  ) => void;
  setIsBottomVisible: (value: boolean) => void;
  setIsFetchingNewMessages: (value: boolean) => void;
  setIsLoadingOlder: (value: boolean) => void;
  setIsLoadingFromAPI: (value: boolean) => void;
  scrollToMessage: (id: string) => Promise<void>;
  handleLoadMore: (force?: boolean) => void;
}

export function useChatMessagesEffects({
  chatId,
  groups,
  lastReadId,
  scrollTargetId,
  lastServerMessageId,
  displayedMessagesCount,
  isSwitchingChat,
  isBottomVisible,
  isLoadingOlder,
  hasMoreLocalMessages,
  hasLoadedAllLocal,
  isLoadingFromAPI,
  hasMoreOnServer,
  containerRef,
  bottomRef,
  prevMessageCountRef,
  prevChatIdRef,
  renderedMessageIds,
  loadingTimeoutRef,
  hasTriedLoadingFromServer,
  fetchTimeoutRef,
  lastFetchedServerMessageIdRef,
  hasInitialFetchRef,
  messageState,
  socket,
  setIsSwitchingChat,
  setShouldAnimate,
  setDisplayedMessagesCount,
  setHasMoreOnServer,
  setExpandedMessages,
  setIsBottomVisible,
  setIsFetchingNewMessages,
  setIsLoadingOlder,
  setIsLoadingFromAPI,
  scrollToMessage,
  handleLoadMore,
}: UseChatMessagesEffectsProps) {
  const { t } = useTranslation();
  const currentUser = useAuthStore((state) => state.user);
  
  // Derive flat messages list from groups for internal logic
  const messages = useMemo(() => groups.flatMap(g => g.messages), [groups]);

  // Effect: Handle chat switching
  useEffect(() => {
    const isActuallySwitchingChat = prevChatIdRef.current !== chatId;

    if (isActuallySwitchingChat) {
      setIsSwitchingChat(true);
      setShouldAnimate(false);
      prevChatIdRef.current = chatId;
      prevMessageCountRef.current = 0;
      renderedMessageIds.current.clear();
      setDisplayedMessagesCount(MESSAGES_PER_GROUP);
      setHasMoreOnServer(true);
      hasTriedLoadingFromServer.current = false;
      setExpandedMessages(new Set());
      setIsFetchingNewMessages(false);
      lastFetchedServerMessageIdRef.current = null;
      hasInitialFetchRef.current = {};
      setIsBottomVisible(false);

      const handleMessageLoaded = () => {
        setShouldAnimate(true);
        setIsSwitchingChat(false);
        requestAnimationFrame(() => {
          if (scrollTargetId && scrollTargetId !== "null") {
            scrollToMessage(scrollTargetId);
          }
        });
      };

      messageState
        .getMessageByRoomId(chatId)
        .then(() => {
          requestAnimationFrame(handleMessageLoaded);
        })
        .catch(() => {
          setIsSwitchingChat(false);
          setShouldAnimate(true);
        });
    }
  }, [chatId, scrollTargetId, messageState, scrollToMessage]);

  // Effect: Track when messages are loaded after switching
  useEffect(() => {
    if (isSwitchingChat && messages.length > 0) {
      const timer = setTimeout(() => {
        setIsSwitchingChat(false);
        setShouldAnimate(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, isSwitchingChat, setIsSwitchingChat, setShouldAnimate]);

  // Effect: Initial fetch if no local messages
  useEffect(() => {
    if (messages.length === 0 && !hasInitialFetchRef.current[chatId]) {
      hasInitialFetchRef.current[chatId] = true;
      setIsFetchingNewMessages(true);

      messageState
        .fetchMessagesFromAPI(chatId, { limit: 100 })
        .then(() => {
          setIsFetchingNewMessages(false);
        })
        .catch(() => {
          setIsFetchingNewMessages(false);
          hasInitialFetchRef.current[chatId] = false;
        });
    }
  }, [chatId, messages.length, messageState, setIsFetchingNewMessages]);

  // Effect: Sync new messages from server
  useEffect(() => {
    if (!lastServerMessageId) return;

    const lastLocalMessageId = messages.at(-1)?.id;

    if (!lastLocalMessageId) return;
    if (lastFetchedServerMessageIdRef.current === lastServerMessageId) return;

    if (lastServerMessageId !== lastLocalMessageId) {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(async () => {
        setIsFetchingNewMessages(true);
        lastFetchedServerMessageIdRef.current = lastServerMessageId;

        try {
          await messageState.fetchNewMessages(chatId, lastLocalMessageId);
        } catch {
          lastFetchedServerMessageIdRef.current = null;
        } finally {
          setIsFetchingNewMessages(false);
        }
      }, 100);
    }

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [
    chatId,
    messages.length,
    lastServerMessageId,
    messageState,
    setIsFetchingNewMessages,
  ]);

  // Effect: Socket reconnect handler
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      setTimeout(async () => {
        try {
          setIsFetchingNewMessages(true);
          await messageState.fetchMessagesFromAPI(chatId, { limit: 50 });

          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            } else if (bottomRef.current) {
              bottomRef.current.scrollIntoView({ behavior: "smooth" });
            }
          });
        } finally {
          setIsFetchingNewMessages(false);
        }
      }, 500);
    };

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [
    socket,
    chatId,
    messageState,
    containerRef,
    bottomRef,
    setIsFetchingNewMessages,
  ]);

  // Effect: Scroll detection and load more
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isSwitchingChat) return;

    let ticking = false;

    const checkScrollPosition = () => {
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 50;
      setIsBottomVisible(isAtBottom);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking && container) {
        globalThis.requestAnimationFrame(() => {
          checkScrollPosition();
        });
        ticking = true;
      }
      handleLoadMore();
    };

    checkScrollPosition();
    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, [isSwitchingChat, containerRef, setIsBottomVisible, handleLoadMore]);

  // Effect: Handle new messages added to local store
  useEffect(() => {
    if (isSwitchingChat) return;

    const currentMessageCount = messages.length;
    const hasNewMessages = currentMessageCount > prevMessageCountRef.current;

    if (hasNewMessages) {
      const newMessage = messages.at(-1);

      if (displayedMessagesCount < currentMessageCount) {
        if (prevMessageCountRef.current > 0) {
          const diff = currentMessageCount - prevMessageCountRef.current;
          setDisplayedMessagesCount((prev) =>
            Math.min(prev + diff, currentMessageCount)
          );
        }
      }

      const isMine = currentUser?._id && newMessage?.sender?._id === currentUser._id;

      if (isMine) {
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          } else if (bottomRef.current) {
            bottomRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        }, 150);
      } else if (isBottomVisible && bottomRef.current) {
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          } else if (bottomRef.current) {
            bottomRef.current.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
          }
        });
      }
    }

    prevMessageCountRef.current = currentMessageCount;
  }, [
    messages,
    isBottomVisible,
    displayedMessagesCount,
    isSwitchingChat,
    containerRef,
    bottomRef,
    setDisplayedMessagesCount,
    currentUser,
  ]);
}

