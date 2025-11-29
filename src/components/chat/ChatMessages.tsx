"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import { ScrollShadow, Skeleton } from "@heroui/react";
import { useEffect, useRef, useMemo, useCallback, memo, use } from "react";
import useRoomStore from "@/store/useRoomStore";
import { useSocket } from "../providers/SocketProvider";
import { motion, AnimatePresence } from "framer-motion";
import { MessageType } from "@/store/types/message.state";
import { emitWithAck } from "./utils/messageHelpers";
import { MESSAGES_PER_GROUP } from "./constants/messageConstants";
import { useChatMessagesState } from "./hooks/useChatMessagesState";
import { useMessageHandlers } from "./hooks/useMessageHandlers";
import { useChatScroll } from "./hooks/useChatScroll";
import { useChatMessagesEffects } from "./hooks/useChatMessagesEffects";
import { ChatLoadingSkeleton } from "./components/ChatLoadingSkeleton";
import { ChatEmptyState } from "./components/ChatEmptyState";
import { ChatLoadingIndicator } from "./components/ChatLoadingIndicator";
import { ScrollToBottomButton } from "./components/ScrollToBottomButton";
import { MessageGroup } from "./components/MessageGroup";

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
    // Performance monitoring
    const startTime = useRef(performance.now());

    useEffect(() => {
      const renderTime = performance.now() - startTime.current;
      if (renderTime > 100) {
        // Log slow renders
        // log removed
      }
    });

    const { socket } = useSocket();
    const roomState = useRoomStore((state) => state);
    const messageState = useMessageStore((state) => state);
    const messages =
      useMessageStore.getState().messagesRoom[chatId]?.messages || [];
    // console.log("🚀 ~ messages:", messages);

    // Compute the most up-to-date message id to use for grouping/scrolling
    const lastMsgId =
      roomState.room?.last_read_id ??
      roomState.room?.last_message?.id ??
      messages.at(-1)?.id ??
      "null";

    // State management hook
    const state = useChatMessagesState(chatId);

    // Scroll functions
    const { scrollToTop, scrollToBottom, scrollToMessage } = useChatScroll({
      containerRef: state.containerRef,
      bottomRef: state.bottomRef,
      displayedMessagesCount: state.displayedMessagesCount,
      messages,
      chatId,
      messageState,
      setDisplayedMessagesCount: state.setDisplayedMessagesCount,
      setIsLoadingOlder: state.setIsLoadingOlder,
      setHasMoreOnServer: state.setHasMoreOnServer,
    });
    useEffect(() => {
      if (toggleInput) {
        scrollToBottom();
      }
    }, [toggleInput]);
    useEffect(() => {
      if (scrollto) {
        scrollToMessage(scrollto);
      }
    }, [scrollto]);
    // Emit with ack helper
    const emitWithAckHelper = useCallback(
      (event: string, payload: any, timeout = 5000) => {
        return emitWithAck(socket, event, payload, timeout);
      },
      [socket]
    );

    // Message handlers
    const handlers = useMessageHandlers({
      chatId,
      socket,
      messageState,
      emitWithAckHelper,
    });

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
    const hasMoreLocalMessages = state.displayedMessagesCount < messages.length;
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

        state.loadingTimeoutRef.current = setTimeout(async () => {
          try {
            if (hasMoreLocalMessages) {
              state.setIsLoadingOlder(true);
              const scrollHeightBefore = container.scrollHeight;

              setTimeout(() => {
                state.setDisplayedMessagesCount((prev) =>
                  Math.min(prev + MESSAGES_PER_GROUP, messages.length)
                );
                state.setIsLoadingOlder(false);

                requestAnimationFrame(() => {
                  const scrollHeightAfter = container.scrollHeight;
                  const scrollDiff = scrollHeightAfter - scrollHeightBefore;
                  container.scrollTop += scrollDiff;
                });
              }, 120);

              return;
            }

            if (
              hasLoadedAllLocal &&
              !state.isLoadingFromAPI &&
              state.hasMoreOnServer
            ) {
              state.setIsLoadingOlder(true);
              state.setIsLoadingFromAPI(true);
              state.hasTriedLoadingFromServer.current = true;

              try {
                const result: any = await messageState.loadOlderMessages(
                  chatId
                );
                state.setIsLoadingOlder(false);
                state.setIsLoadingFromAPI(false);

                if (!result || (Array.isArray(result) && result.length === 0)) {
                  state.setHasMoreOnServer(false);
                }
              } catch (error: any) {
                // log removed
                state.setIsLoadingOlder(false);
                state.setIsLoadingFromAPI(false);
              }
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
        state.setDisplayedMessagesCount,
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
    const { visibleGroups } = useChatMessagesEffects({
      chatId,
      messages,
      lastMsgId,
      displayedMessagesCount: state.displayedMessagesCount,
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
      roomState,
      messageState,
      socket,
      setIsSwitchingChat: state.setIsSwitchingChat,
      setShouldAnimate: state.setShouldAnimate,
      setDisplayedMessagesCount: state.setDisplayedMessagesCount,
      setHasMoreOnServer: state.setHasMoreOnServer,
      setExpandedMessages: state.setExpandedMessages,
      setIsBottomVisible: state.setIsBottomVisible,
      setIsFetchingNewMessages: state.setIsFetchingNewMessages,
      setIsLoadingOlder: state.setIsLoadingOlder,
      setIsLoadingFromAPI: state.setIsLoadingFromAPI,
      setIsTopVisible: state.setIsTopVisible,
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
        roomState.markMessageAsRead(chatId, id, socket);
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
            className={`p-4 overflow-y-auto w-full max-h-[calc(100vh-200px)] transition-all duration-200 ${
              state.isFetchingNewMessages ? "bg-blue-50/20" : ""
            }`}
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
                <div className="text-xs text-gray-400">
                  📜 Còn {messages.length - state.displayedMessagesCount} tin
                  nhắn cũ hơn • Cuộn lên để tải{" "}
                  <button
                    className="text-blue-500 cursor-pointer"
                    onClick={() => handleLoadMore()}
                  >
                    thêm...
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
                            style={{ width: `${60 + Math.random() * 40}%` }}
                          />
                          <Skeleton className="h-3 w-12 rounded mt-1" />
                        </div>
                        {idx % 2 === 1 && (
                          <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                        )}
                      </div>
                    ))}
                    <div className="text-center mt-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-3"></div>
                      <Skeleton className="h-4 w-32 rounded mx-auto" />
                    </div>
                  </div>
                )}

              {/* Message groups */}
              {visibleGroups.map((group, groupIdx) => (
                <MessageGroup
                  key={`message-group-${group.dateLabel}-${groupIdx}`}
                  group={group}
                  groupIdx={groupIdx}
                  shouldAnimate={state.shouldAnimate}
                  expandedMessages={state.expandedMessages}
                  lastMsgId={lastMsgId}
                  chatId={chatId}
                  socket={socket}
                  noAction={noAction}
                  renderedMessageIds={state.renderedMessageIds}
                  onToggleExpanded={toggleExpanded}
                  onReply={handlers.handleReply}
                  onReact={handlers.handleReact}
                  onDelete={handlers.handleDelete}
                  onRecall={handlers.handleRecall}
                  onTogglePin={handlers.handleTogglePin}
                  onCopy={handlers.handleCopy}
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
          unreadCount={roomState?.room?.unread_count ?? 0}
          isRead={roomState?.room?.is_read}
          onScrollToBottom={scrollToBottom}
        />
      </>
    );
  }
);

ChatMessages.displayName = "ChatMessages";
