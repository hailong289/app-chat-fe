"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import { ScrollShadow, Skeleton } from "@heroui/react";
import { useEffect, useRef, useMemo, useCallback, memo } from "react";
import useRoomStore from "@/store/useRoomStore";
import type { RoomsState } from "@/store/types/room.state";
import { useSocket } from "../../providers/SocketProvider";
import { motion, AnimatePresence } from "framer-motion";
import { MessageType, MessageGroup as MessageGroupType } from "@/store/types/message.state";
import { sliceVisibleGroups } from "@/libs/timeline-helpers"; 
import { emitWithAck } from "../../../utils/messageHelpers";
import { MESSAGES_PER_GROUP } from "../constants/messageConstants";
import { useChatMessagesState } from "../hooks/useChatMessagesState";
import { useMessageHandlers } from "../hooks/useMessageHandlers";
import { useChatScroll } from "../hooks/useChatScroll";
import { useChatMessagesEffects } from "../hooks/useChatMessagesEffects";
import { ChatLoadingSkeleton } from "./ChatLoadingSkeleton";
import { ChatEmptyState } from "./ChatEmptyState";
import { ChatLoadingIndicator } from "./ChatLoadingIndicator";
import { ScrollToBottomButton } from "./ScrollToBottomButton";
import MessageGroup from "./MessageGroup";
import { useTranslation } from "react-i18next";

const EMPTY_MESSAGES: MessageType[] = [];
const EMPTY_GROUPS: MessageGroupType[] = [];

const selectMarkMessageAsRead = (state: RoomsState) => state.markMessageAsRead;

const selectLastReadId = (state: RoomsState) =>
  state.room?.last_read_id ?? null;

const selectLastServerMessageId = (state: RoomsState) =>
  state.room?.last_message?.id ?? null;

const selectUnreadCount = (state: RoomsState) => state.room?.unread_count ?? 0;

const selectIsRead = (state: RoomsState) => state.room?.is_read ?? false;

export const ChatMessages = memo(
  ({
    chatId,
    noAction,
    scrollto,
    toggleInput,
  }: {
    chatId: string;
    noAction: boolean;
    scrollto?: string | null;
    toggleInput: boolean;
  }) => {
    const { t } = useTranslation();
    // Performance monitoring
    const startTime = useRef(performance.now());

    useEffect(() => {
      const renderTime = performance.now() - startTime.current;
      if (renderTime > 100) {
        // Log slow renders
        // log removed
      }
    });

    const { socket } = useSocket("/chat");
    const markMessageAsRead = useRoomStore(selectMarkMessageAsRead);
    const lastReadId = useRoomStore(selectLastReadId);
    const lastServerMessageId = useRoomStore(selectLastServerMessageId);
    const unreadCount = useRoomStore(selectUnreadCount);
    const isRead = useRoomStore(selectIsRead);
    const roomMeta = useMemo(
      () => ({ lastReadId, lastServerMessageId, unreadCount, isRead }),
      [lastReadId, lastServerMessageId, unreadCount, isRead]
    );

    // Fetch pre-calculated visible groups from store
    // Use separate selectors to avoid unnecessary re-renders when return value is a new object
    const groups = useMessageStore(
      useCallback((state) => state.messagesRoom[chatId]?.groups || EMPTY_GROUPS, [chatId])
    );
    
    const displayedMessagesCount = useMessageStore(
      useCallback((state) => state.messagesRoom[chatId]?.displayedMessagesCount || 20, [chatId])
    );

    // Optimize store subscription
    // Derived messages for local usage if needed (e.g. for length checks)
    const messages = useMemo(() => groups.flatMap(g => g.messages), [groups]);

    // Compute visible groups from all groups
    const visibleGroups = useMemo(
      () => sliceVisibleGroups(groups, displayedMessagesCount),
      [groups, displayedMessagesCount]
    );

    const isLoadingMessage = useMessageStore((state) => state.isLoading);
    const fetchMessagesFromAPI = useMessageStore(
      (state) => state.fetchMessagesFromAPI
    );
    const getMessageByRoomId = useMessageStore(
      (state) => state.getMessageByRoomId
    );
    const loadOlderMessages = useMessageStore(
      (state) => state.loadOlderMessages
    );
    const findMessage = useMessageStore((state) => state.findMessage);
    const resendMessage = useMessageStore((state) => state.resendMessage);
    const fetchNewMessages = useMessageStore((state) => state.fetchNewMessages);

    // Create a stable messageState object for hooks that need it
    // This avoids re-rendering when unrelated parts of the store change
    const messageState = useMemo(
      () => ({
        isLoading: isLoadingMessage,
        fetchMessagesFromAPI,
        getMessageByRoomId,
        loadOlderMessages,
        findMessage,
        resendMessage,
        fetchNewMessages,
      }),
      [
        isLoadingMessage,
        fetchMessagesFromAPI,
        getMessageByRoomId,
        loadOlderMessages,
        findMessage,
        resendMessage,
        fetchNewMessages,
      ]
    );

    // Memoize handlers to prevent re-creation on every render
    const emitWithAckHelper = useCallback(
      (event: string, payload: any, timeout = 5000) => {
        return emitWithAck(socket, event, payload, timeout);
      },
      [socket]
    );

    const handlers = useMessageHandlers({
      chatId,
      socket,
      messageState,
      emitWithAckHelper,
    });

    // Memoize handlers object passed to MessageGroup
    const memoizedHandlers = useMemo(
      () => ({
        onReply: handlers.handleReply,
        onReact: handlers.handleReact,
        onDelete: handlers.handleDelete,
        onRecall: handlers.handleRecall,
        onTogglePin: handlers.handleTogglePin,
        onCopy: handlers.handleCopy,
        onTranslate: handlers.handleTranslate,
        onSummarize: handlers.handleSummarize,
      }),
      [
        handlers.handleReply,
        handlers.handleReact,
        handlers.handleDelete,
        handlers.handleRecall,
        handlers.handleTogglePin,
        handlers.handleCopy,
        handlers.handleTranslate,
        handlers.handleSummarize,
      ]
    );

    // Compute the most up-to-date message id to use for grouping/scrolling
    const latestMessageId = messages.at(-1)?.id ?? null;
    const lastMsgId = roomMeta.lastServerMessageId ?? latestMessageId ?? "null";
    const scrollTargetId = roomMeta.lastReadId ?? lastMsgId;

    const storeSetDisplayedCount = useMessageStore(
      (state) => state.setDisplayedMessagesCount
    );

    const handleSetDisplayedCount = useCallback(
      (countOrUpdater: number | ((prev: number) => number)) => {
        let newCount: number;
        if (typeof countOrUpdater === "function") {
          newCount = countOrUpdater(displayedMessagesCount);
        } else {
          newCount = countOrUpdater;
        }
        storeSetDisplayedCount(chatId, newCount);
      },
      [chatId, displayedMessagesCount, storeSetDisplayedCount]
    );

    // State management hook
    const state = useChatMessagesState(chatId);

    // Scroll functions
    const { scrollToTop, scrollToBottom, scrollToMessage } = useChatScroll({
      containerRef: state.containerRef,
      bottomRef: state.bottomRef,
      displayedMessagesCount, // Use consistent count
      messages,
      chatId,
      messageState,
      setDisplayedMessagesCount: handleSetDisplayedCount, // Use store setter wrapper
      setIsLoadingOlder: state.setIsLoadingOlder,
      setHasMoreOnServer: state.setHasMoreOnServer,
    });

    useEffect(() => {
      if (toggleInput) {
        scrollToBottom();
      }
    }, [toggleInput, scrollToBottom]);

    useEffect(() => {
      if (scrollto) {
        scrollToMessage(scrollto);
      }
    }, [scrollto, scrollToMessage]);

    // Toggle expanded state for long messages
    const toggleExpanded = useCallback(
      (id: string) => {
        state.setExpandedMessages((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(id)) {
            newSet.delete(id);
          } else {
            newSet.add(id);
          }
          return newSet;
        });
      },
      [state.setExpandedMessages]
    );

    // Load more handler
    const hasMoreLocalMessages = displayedMessagesCount < messages.length;
    const hasLoadedAllLocal = messages.length > 0 && !hasMoreLocalMessages;

    const handleLoadMore = useCallback(
      (force = false) => {
        if (state.isLoadingOlder || state.isSwitchingChat) return;

        const container = state.containerRef.current;
        if (!container) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtTop = scrollTop <= 50;
        const hasScroll = scrollHeight > clientHeight + 10;

        if (!isAtTop && !force) return;
        if (!hasScroll && !force) return;

        if (state.loadingTimeoutRef.current) {
          clearTimeout(state.loadingTimeoutRef.current);
        }

        // Extracted inner logic to reduce nesting
        function handleLocalMessages(container: HTMLDivElement) {
          state.setIsLoadingOlder(true);
          const scrollHeightBefore = container.scrollHeight;

          setTimeout(() => {
            handleSetDisplayedCount((prev) =>
              Math.min(prev + MESSAGES_PER_GROUP, messages.length)
            );
            state.setIsLoadingOlder(false);

            requestAnimationFrame(() => {
              const scrollHeightAfter = container.scrollHeight;
              const scrollDiff = scrollHeightAfter - scrollHeightBefore;
              container.scrollTop += scrollDiff;
            });
          }, 120);
        }

        async function handleServerMessages() {
          state.setIsLoadingOlder(true);
          state.setIsLoadingFromAPI(true);
          state.hasTriedLoadingFromServer.current = true;

          const container = state.containerRef.current;
          const scrollHeightBefore = container ? container.scrollHeight : 0;

          try {
            const result: any = await messageState.loadOlderMessages(chatId);

            // Wait for render to update scrollHeight
            setTimeout(() => {
              state.setIsLoadingOlder(false);
              state.setIsLoadingFromAPI(false);

              if (!result || (Array.isArray(result) && result.length === 0)) {
                state.setHasMoreOnServer(false);
              }

              if (container) {
                requestAnimationFrame(() => {
                  const scrollHeightAfter = container.scrollHeight;
                  const scrollDiff = scrollHeightAfter - scrollHeightBefore;
                  if (scrollDiff > 0) {
                    container.scrollTop += scrollDiff;
                  }
                });
              }
            }, 50);
          } catch (error: any) {
            console.error("Failed to load older messages:", error);
            state.setIsLoadingOlder(false);
            state.setIsLoadingFromAPI(false);
          }
        }

        state.loadingTimeoutRef.current = setTimeout(async () => {
          try {
            if (hasMoreLocalMessages) {
              handleLocalMessages(container);
              return;
            }

            if (
              hasLoadedAllLocal &&
              !state.isLoadingFromAPI &&
              state.hasMoreOnServer
            ) {
              await handleServerMessages();
            }
          } finally {
            if (state.loadingTimeoutRef.current) {
              clearTimeout(state.loadingTimeoutRef.current);
              state.loadingTimeoutRef.current = null;
            }
          }
        }, 300);
      },
      [
        state.isLoadingOlder,
        state.isSwitchingChat,
        state.containerRef,
        state.loadingTimeoutRef,
        state.setIsLoadingOlder,
        // Removed state.setDisplayedMessagesCount
        handleSetDisplayedCount,
        state.setIsLoadingFromAPI,
        state.setHasMoreOnServer,
        hasMoreLocalMessages,
        hasLoadedAllLocal,
        state.isLoadingFromAPI,
        state.hasMoreOnServer,
        messages.length,
        chatId,
        messageState,
      ]
    );

    // Effects hook
    useChatMessagesEffects({
      chatId,
      groups, // Changed from messages
      lastReadId: roomMeta.lastReadId,
      scrollTargetId,
      lastServerMessageId: roomMeta.lastServerMessageId,
      displayedMessagesCount, // Use consistent count
      isSwitchingChat: state.isSwitchingChat,
      isBottomVisible: state.isBottomVisible,
      isLoadingOlder: state.isLoadingOlder,
      hasMoreLocalMessages,
      hasLoadedAllLocal,
      isLoadingFromAPI: state.isLoadingFromAPI,
      hasMoreOnServer: state.hasMoreOnServer,
      containerRef: state.containerRef,
      bottomRef: state.bottomRef,
      prevMessageCountRef: state.prevMessageCountRef,
      prevChatIdRef: state.prevChatIdRef,
      renderedMessageIds: state.renderedMessageIds,
      loadingTimeoutRef: state.loadingTimeoutRef,
      hasTriedLoadingFromServer: state.hasTriedLoadingFromServer,
      fetchTimeoutRef: state.fetchTimeoutRef,
      lastFetchedServerMessageIdRef: state.lastFetchedServerMessageIdRef,
      hasInitialFetchRef: state.hasInitialFetchRef,
      messageState,
      socket,
      setIsSwitchingChat: state.setIsSwitchingChat,
      setShouldAnimate: state.setShouldAnimate,
      setDisplayedMessagesCount: handleSetDisplayedCount, // Use store setter
      setHasMoreOnServer: state.setHasMoreOnServer,
      setExpandedMessages: state.setExpandedMessages,
      setIsBottomVisible: state.setIsBottomVisible,
      setIsFetchingNewMessages: state.setIsFetchingNewMessages,
      setIsLoadingOlder: state.setIsLoadingOlder,
      setIsLoadingFromAPI: state.setIsLoadingFromAPI,
      scrollToMessage,
      handleLoadMore,
    });

    // Read progress hook
    const { setMessageRef } = useReadProgress({
      messages,
      container: state.containerRef.current,
      stickyBottomPx: 0,
      minVisibleRatio: 0.5,
      onCommit: (id: string) => {
        markMessageAsRead(chatId, id, socket);
      },
    });

    return (
      <>
        {/* Loading overlay với Skeleton khi chuyển chat */}
        <AnimatePresence>
          {state.isSwitchingChat && <ChatLoadingSkeleton chatId={chatId} />}
        </AnimatePresence>

        {!state.isSwitchingChat && (
          <ScrollShadow
            ref={state.containerRef}
            className={`
              p-4 overflow-y-auto w-full max-h-[calc(100vh-250px)]
              transition-all duration-200 
              ${
                state.isFetchingNewMessages
                  ? "bg-blue-50/20 dark:bg-blue-950/30"
                  : ""
              }
            `}
          >
            {/* Top marker */}
            <div ref={state.topRef} className="relative">
              {/* Loading indicators */}
              <ChatLoadingIndicator
                isLoadingOlder={state.isLoadingOlder}
                isLoadingFromAPI={state.isLoadingFromAPI}
                isFetchingNewMessages={state.isFetchingNewMessages}
                messageStateLoading={messageState.isLoading}
              />
            </div>

            {/* Info hiển thị trạng thái */}
            {hasMoreLocalMessages && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-2 mb-2"
              >
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  📜{" "}
                  {t("chat.messages.scroll.more", {
                    count: messages.length - displayedMessagesCount,
                  })}{" "}
                  <button
                    className="text-blue-500 dark:text-blue-400 cursor-pointer"
                    onClick={() => handleLoadMore()}
                  >
                    {t("chat.messages.scroll.loadMore")}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Messages container */}
            <motion.div
              animate={{
                opacity: state.isSwitchingChat ? 0 : 1,
                y: state.isSwitchingChat ? 10 : 0,
              }}
              transition={{ duration: 0.2 }}
            >
              {/* Empty state */}
              {visibleGroups.length === 0 &&
                !state.isFetchingNewMessages &&
                !messageState.isLoading &&
                !state.isSwitchingChat && <ChatEmptyState />}

              {/* Loading skeleton */}
              {visibleGroups.length === 0 &&
                (state.isFetchingNewMessages || messageState.isLoading) &&
                !state.isSwitchingChat && (
                  <div className="space-y-6 mt-6">
                    <div className="flex items-center justify-center">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    {Array.from({ length: 3 }, (_, idx) => (
                      <div
                        key={`loading-skeleton-${chatId}-${idx}`}
                        className={`flex gap-3 ${
                          idx % 2 === 0 ? "justify-start" : "justify-end"
                        }`}
                      >
                        {idx % 2 === 0 && (
                          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        )}
                        <div className="flex flex-col max-w-xs">
                          {idx % 2 === 0 && (
                            <Skeleton className="h-3 w-16 rounded mb-1" />
                          )}
                          <Skeleton
                            className={`h-10 rounded-2xl ${
                              idx % 2 === 0 ? "rounded-tl-md" : "rounded-tr-md"
                            }`}
                            style={{
                              width: `${60 + Math.random() * 40}%`,
                            }}
                          />
                          <Skeleton className="h-3 w-12 rounded mt-1" />
                        </div>
                        {idx % 2 === 1 && (
                          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        )}
                      </div>
                    ))}
                    <div className="text-center mt-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 dark:border-blue-400 border-t-transparent mx-auto mb-3"></div>
                      <Skeleton className="h-4 w-32 rounded mx-auto" />
                    </div>
                  </div>
                )}

              {/* Message groups */}
              {visibleGroups.map((group) => (
                <MessageGroup
                  key={`message-group-${group.dateLabel}`}
                  group={group}
                  shouldAnimate={state.shouldAnimate}
                  expandedMessages={state.expandedMessages}
                  lastMsgId={lastMsgId}
                  chatId={chatId}
                  socket={socket}
                  noAction={noAction}
                  renderedMessageIds={state.renderedMessageIds}
                  onToggleExpanded={toggleExpanded}
                  onReply={memoizedHandlers.onReply}
                  onReact={memoizedHandlers.onReact}
                  onDelete={memoizedHandlers.onDelete}
                  onRecall={memoizedHandlers.onRecall}
                  onTogglePin={memoizedHandlers.onTogglePin}
                  onCopy={memoizedHandlers.onCopy}
                  onTranslate={memoizedHandlers.onTranslate}
                  onSummarize={memoizedHandlers.onSummarize}
                  onJumpToMessage={scrollToMessage}
                  setMessageRef={setMessageRef}
                  messageState={messageState}
                />
              ))}
            </motion.div>

            {/* Bottom marker */}
            <div ref={state.bottomRef} className="h-1 w-full" />
          </ScrollShadow>
        )}

        {/* Scroll to bottom button */}
        <ScrollToBottomButton
          isVisible={
            !state.isBottomVisible &&
            messages.length > 0 &&
            !state.isSwitchingChat
          }
          unreadCount={roomMeta.unreadCount}
          isRead={roomMeta.isRead}
          onScrollToBottom={scrollToBottom}
        />
      </>
    );
  }
);

ChatMessages.displayName = "ChatMessages";
