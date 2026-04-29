import { useEffect, useMemo } from "react";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { MessageGroup } from "@/store/types/message.state";
import useAuthStore from "@/store/useAuthStore";
import useMessageStore from "@/store/useMessageStore";

interface UseChatMessagesEffectsProps {
  chatId: string;
  groups: MessageGroup[];
  lastReadId: string | null;
  scrollTargetId: string;
  lastServerMessageId: string | null;
  displayedMessagesCount: number;
  loadingChatId: string | null;
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
  loadedChatIdRef: React.MutableRefObject<string | null>;
  messageState: any;
  socket: any;
  setLoadingChatId: (
    value: string | null | ((prev: string | null) => string | null),
  ) => void;
  setShouldAnimate: (value: boolean) => void;
  setDisplayedMessagesCount: (
    count: number | ((prev: number) => number),
  ) => void;
  setHasMoreOnServer: (value: boolean) => void;
  setExpandedMessages: (
    value: Set<string> | ((prev: Set<string>) => Set<string>),
  ) => void;
  setIsBottomVisible: (value: boolean) => void;
  setIsLoadingOlder: (value: boolean) => void;
  setIsLoadingFromAPI: (value: boolean) => void;
  scrollToMessage: (id: string) => Promise<void>;
  handleLoadMore: (force?: boolean) => void;
}

export function useChatMessagesEffects({
  chatId,
  groups,
  scrollTargetId,
  lastServerMessageId,
  displayedMessagesCount,
  loadingChatId,
  isBottomVisible,
  containerRef,
  bottomRef,
  prevMessageCountRef,
  prevChatIdRef,
  renderedMessageIds,
  hasTriedLoadingFromServer,
  fetchTimeoutRef,
  lastFetchedServerMessageIdRef,
  loadedChatIdRef,
  messageState,
  socket,
  setLoadingChatId,
  setShouldAnimate,
  setDisplayedMessagesCount,
  setHasMoreOnServer,
  setExpandedMessages,
  setIsBottomVisible,
  scrollToMessage,
  handleLoadMore,
}: UseChatMessagesEffectsProps) {
  const currentUser = useAuthStore((state) => state.user);

  // Derive flat messages list from groups for internal logic
  const messages = useMemo(() => groups.flatMap((g) => g.messages), [groups]);
  const isLoadingThisChat = loadingChatId === chatId;

  // ────────────────────────────────────────────────────────────────
  // Effect: chat-switch + initial load — single source of truth.
  //
  // One promise, one flag. On chatId change:
  //   1. Reset transient UI state (scroll, expanded, refs).
  //   2. If the store already has visible messages for this room
  //      (returned from a prior visit), paint immediately and run a
  //      silent background sync via `loadRoomFromCache`.
  //   3. Otherwise flip `loadingChatId = chatId` so the skeleton shows,
  //      then await `loadRoomFromCache` → flip back to `null` when the
  //      network round-trip settles (success, empty, or error).
  //
  // Replaces the old chained pair of effects (`isSwitchingChat` set
  // here, cleared by a separate `messages.length > 0` watcher;
  // `isFetchingNewMessages` toggled in a third effect) which deadlocked
  // for genuinely empty rooms — the watcher never fired, the spinner
  // spun forever.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      prevMessageCountRef.current = 0;
      renderedMessageIds.current.clear();
      setDisplayedMessagesCount(MESSAGES_PER_GROUP);
      setHasMoreOnServer(true);
      hasTriedLoadingFromServer.current = false;
      setExpandedMessages(new Set());
      lastFetchedServerMessageIdRef.current = null;
      setIsBottomVisible(false);
    }

    // Once-per-chatId guard. Without this, every dep churn (refs,
    // setters, scrollToMessage callback identity, etc.) re-fires the
    // effect → loadRoomFromCache → /api/chat/messages spam.
    if (loadedChatIdRef.current === chatId) return;
    loadedChatIdRef.current = chatId;

    // Snapshot the chatId this attempt is for. The "is this still the
    // active chat?" check is done by comparing `loadedChatIdRef.current`
    // — if the user has since switched, the ref points elsewhere and
    // we no-op. This replaces a buggy `cancelled` flag that fired in
    // the cleanup even when the same-chatId guard above re-skipped:
    // the ref-based check is precise (per-chatId) instead of
    // per-effect-instance.
    const myChatId = chatId;
    const isStillActive = () => loadedChatIdRef.current === myChatId;

    const storeRoom = useMessageStore.getState().messagesRoom[chatId];
    const hasCachedInStore = !!storeRoom?.groups?.some(
      (g) => g.messages.length > 0,
    );

    if (hasCachedInStore) {
      setShouldAnimate(true);
      requestAnimationFrame(() => {
        if (scrollTargetId && scrollTargetId !== "null") {
          scrollToMessage(scrollTargetId);
        }
      });
    } else {
      setLoadingChatId(chatId);
      setShouldAnimate(false);
    }

    const finishLoading = () => {
      // Use functional setState — the comparator handles the "user has
      // since switched chats" case (cur !== myChatId) without needing a
      // separate flag. setShouldAnimate is safe in either case.
      setLoadingChatId((cur) => (cur === myChatId ? null : cur));
      setShouldAnimate(true);
    };

    // Retry the API call on failure (network error, 5xx, etc.) — up to
    // 3 attempts with exponential backoff (500ms, 1s, 2s). Empty
    // results are NOT errors → no retry. After max attempts the
    // spinner clears so the user isn't trapped.
    const MAX_ATTEMPTS = 3;
    const attempt = async (n: number): Promise<void> => {
      if (!isStillActive()) return;
      try {
        const { fetched } = await useMessageStore
          .getState()
          .loadRoomFromCache(chatId, 20);
        await fetched;
        finishLoading();
      } catch (err) {
        if (!isStillActive()) return;
        if (n >= MAX_ATTEMPTS - 1) {
          console.warn(
            `[ChatMessages] loadRoomFromCache failed for ${chatId} after ${MAX_ATTEMPTS} attempts`,
            err,
          );
          finishLoading();
          return;
        }
        const delay = 500 * Math.pow(2, n);
        setTimeout(() => {
          if (!isStillActive()) return;
          void attempt(n + 1);
        }, delay);
      }
    };
    void attempt(0);

    // Hard safety net: drop the spinner after 10s. Still gated by
    // isStillActive so a delayed firing on a newer chat is a no-op.
    setTimeout(() => {
      if (isStillActive()) finishLoading();
    }, 10000);
  }, [
    chatId,
    scrollTargetId,
    scrollToMessage,
    setLoadingChatId,
    setShouldAnimate,
    setDisplayedMessagesCount,
    setHasMoreOnServer,
    setExpandedMessages,
    setIsBottomVisible,
    prevChatIdRef,
    prevMessageCountRef,
    renderedMessageIds,
    hasTriedLoadingFromServer,
    lastFetchedServerMessageIdRef,
  ]);

  // ────────────────────────────────────────────────────────────────
  // Effect: silent delta sync when server's `last_message.id` changes
  // mid-session (socket pushed a new message that bypassed the cache
  // path). No spinner — user is already reading the chat, so the skim
  // happens in the background.
  // ────────────────────────────────────────────────────────────────
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
        lastFetchedServerMessageIdRef.current = lastServerMessageId;
        try {
          await messageState.fetchNewMessages(chatId, lastLocalMessageId);
        } catch {
          lastFetchedServerMessageIdRef.current = null;
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
    messages,
    lastServerMessageId,
    messageState,
    fetchTimeoutRef,
    lastFetchedServerMessageIdRef,
  ]);

  // ────────────────────────────────────────────────────────────────
  // Effect: silent re-sync on socket reconnect — pull the latest 50 in
  // case any messages were missed during the network blip. No spinner.
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      setTimeout(async () => {
        await messageState.fetchMessagesFromAPI(chatId, { limit: 50 });
        requestAnimationFrame(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop =
              containerRef.current.scrollHeight;
          } else if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
          }
        });
      }, 500);
    };

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, chatId, messageState, containerRef, bottomRef]);

  // Effect: Scroll detection and load more
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isLoadingThisChat) return;

    let ticking = false;

    // Track whether the user has performed a real scroll since the
    // chat tab opened. Without this, brand-new rooms with so few
    // messages that scrollTop=0 by default would auto-trigger
    // handleLoadMore the moment the listener registers — looking
    // exactly like an infinite "loading older messages" loop. We only
    // arm `handleLoadMore` after we've seen scrollTop change at least
    // once (true user gesture: wheel, drag, keyboard). The "Load more"
    // button bypasses this via `force=true`.
    let userHasScrolled = false;
    let lastScrollTop = container.scrollTop;

    const checkScrollPosition = () => {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 50;
      setIsBottomVisible(isAtBottom);
      ticking = false;
    };

    const handleScroll = () => {
      const currentTop = container.scrollTop;
      if (!userHasScrolled && currentTop !== lastScrollTop) {
        userHasScrolled = true;
      }
      lastScrollTop = currentTop;

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
  }, [isLoadingThisChat, containerRef, setIsBottomVisible, handleLoadMore]);

  // Effect: Handle new messages added to local store — autoscroll if
  // the user sent it OR is already at the bottom.
  useEffect(() => {
    if (isLoadingThisChat) return;

    const currentMessageCount = messages.length;
    const hasNewMessages = currentMessageCount > prevMessageCountRef.current;

    if (hasNewMessages) {
      const newMessage = messages.at(-1);

      if (displayedMessagesCount < currentMessageCount) {
        if (prevMessageCountRef.current > 0) {
          const diff = currentMessageCount - prevMessageCountRef.current;
          setDisplayedMessagesCount((prev) =>
            Math.min(prev + diff, currentMessageCount),
          );
        }
      }

      const isMine =
        currentUser?._id && newMessage?.sender?._id === currentUser._id;

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
    isLoadingThisChat,
    containerRef,
    bottomRef,
    setDisplayedMessagesCount,
    currentUser,
    prevMessageCountRef,
  ]);
}
