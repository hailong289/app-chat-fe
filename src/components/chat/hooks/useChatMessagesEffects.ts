import { useEffect, useMemo } from "react";
import { groupMessagesByDate } from "@/libs/timeline-helpers";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { useTranslation } from "react-i18next";

interface UseChatMessagesEffectsProps {
  chatId: string;
  messages: any[];
  lastMsgId: string;
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
  roomState: any;
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
  setIsTopVisible: (value: boolean) => void;
  scrollToMessage: (id: string) => Promise<void>;
  handleLoadMore: (force?: boolean) => void;
}

export function useChatMessagesEffects({
  chatId,
  messages,
  lastMsgId,
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
  roomState,
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
  setIsTopVisible,
  scrollToMessage,
  handleLoadMore,
}: UseChatMessagesEffectsProps) {
  const { t } = useTranslation();
  // Effect: Handle chat switching
  useEffect(() => {
    const isActuallySwitchingChat = prevChatIdRef.current !== chatId;

    if (isActuallySwitchingChat) {
      setIsSwitchingChat(true);
      setShouldAnimate(false);
      prevChatIdRef.current = chatId;
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
          scrollToMessage(lastMsgId);
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
  }, [chatId, lastMsgId, messageState, scrollToMessage]);

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
    if (!roomState.room?.last_message?.id) return;

    const lastLocalMessageId = messages.at(-1)?.id;
    const lastServerMessageId = roomState.room.last_message.id;

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
    roomState.room?.last_message?.id,
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
      const isAtTop = scrollTop <= 50;

      setIsBottomVisible(isAtBottom);
      setIsTopVisible(isAtTop);
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
  }, [
    isSwitchingChat,
    containerRef,
    setIsBottomVisible,
    setIsTopVisible,
    handleLoadMore,
  ]);

  // Effect: Handle new messages added to local store
  useEffect(() => {
    if (isSwitchingChat) return;

    const currentMessageCount = messages.length;
    const hasNewMessages = currentMessageCount > prevMessageCountRef.current;

    if (hasNewMessages) {
      const newMessage = messages.at(-1);

      if (displayedMessagesCount < currentMessageCount) {
        setDisplayedMessagesCount(
          Math.max(currentMessageCount, MESSAGES_PER_GROUP)
        );
      }

      if (newMessage?.isMine) {
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
  ]);

  // Memoized: Visible messages
  const visibleMessages = useMemo(() => {
    const visible = messages || [];
    return visible.slice(-displayedMessagesCount);
  }, [messages, displayedMessagesCount]);

  // Memoized: Visible groups
  const visibleGroups = useMemo(() => {
    return groupMessagesByDate(visibleMessages, lastMsgId, t);
  }, [visibleMessages, lastMsgId, t]);

  return {
    visibleMessages,
    visibleGroups,
  };
}
