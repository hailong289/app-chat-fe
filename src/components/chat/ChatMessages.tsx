"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import {
  ChevronDoubleDownIcon,
  EyeDropperIcon,
  EllipsisVerticalIcon,
  ArrowUturnLeftIcon,
  FaceSmileIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  XMarkIcon,
  HeartIcon,
} from "@heroicons/react/16/solid";
import {
  Avatar,
  Button,
  ScrollShadow,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Skeleton,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import {
  groupMessagesByDate,
  formatMessageTime,
} from "@/libs/timeline-helpers";
import { CompactFileGallery } from "../CompactFileGallery";
import useRoomStore from "@/store/useRoomStore";
import { useSocket } from "../providers/SocketProvider";
import { LinkPreview } from "./LinkPreview";
import { extractFirstUrl } from "@/libs/url-helpers";
import { motion, AnimatePresence } from "framer-motion";

export const ChatMessages = memo(({ chatId }: { chatId: string }) => {
  // Performance monitoring
  const startTime = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - startTime.current;
    if (renderTime > 100) {
      // Log slow renders
      console.warn(`🐌 Slow ChatMessages render: ${renderTime.toFixed(2)}ms`);
    }
  });

  const { socket } = useSocket();
  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);
  const messages = messageState.messagesRoom[chatId]?.messages || [];
  const lastMsgId = roomState.room?.last_read_id || "null";
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set()
  ); // Track expanded messages

  const [replyingTo, setReplyingTo] = useState<any>(null); // Track message being replied to

  const [isBottomVisible, setIsBottomVisible] = useState(false);
  const [isTopVisible, setIsTopVisible] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  //  xử lý cuộn
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0); // Track previous message count
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Debounce for loading
  const prevChatIdRef = useRef(chatId); // Track chat switching
  const [shouldAnimate, setShouldAnimate] = useState(false); // Control animations
  const renderedMessageIds = useRef(new Set<string>()); // Track rendered messages

  // Pagination state for virtual scrolling - Optimized for better performance
  const MESSAGES_PER_GROUP = 15; // Giảm từ 20 xuống 15 tin nhắn mỗi lần load để tăng tốc LCP
  const [displayedMessagesCount, setDisplayedMessagesCount] =
    useState(MESSAGES_PER_GROUP);
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false); // Track API loading
  const [hasMoreOnServer, setHasMoreOnServer] = useState(true); // Track if server has more messages
  const hasTriedLoadingFromServer = useRef(false); // Track nếu đã thử load từ server
  const [isFetchingNewMessages, setIsFetchingNewMessages] = useState(false); // Track fetching new messages
  const [isSwitchingChat, setIsSwitchingChat] = useState(false); // Track chat switching
  //

  useEffect(() => {
    const isActuallySwitchingChat = prevChatIdRef.current !== chatId;

    if (isActuallySwitchingChat) {
      // Set loading state ngay khi bắt đầu chuyển chat
      setIsSwitchingChat(true);

      // Disable animations khi chuyển chat
      setShouldAnimate(false);
      prevChatIdRef.current = chatId;
      renderedMessageIds.current.clear(); // Clear tracked messages
      setDisplayedMessagesCount(MESSAGES_PER_GROUP); // Reset về 20 messages khi chuyển chat
      setHasMoreOnServer(true); // Reset server flag when switching chats
      hasTriedLoadingFromServer.current = false; // Reset tried flag
      setExpandedMessages(new Set()); // Reset expanded messages when switching chats
      setReplyingTo(null); // Reset reply target
      setIsFetchingNewMessages(false); // Reset fetching state khi chuyển chat
      lastFetchedServerMessageIdRef.current = null; // Reset fetch tracking khi chuyển chat

      setIsBottomVisible(false);

      // Load messages cho chat mới
      messageState.getMessageByRoomId(chatId);

      // Delay để đảm bảo messages được load và render xong
      const renderTimer = setTimeout(() => {
        setShouldAnimate(true);
        setIsSwitchingChat(false); // Tắt loading state sau khi render xong

        // Scroll sau khi data load xong
        requestAnimationFrame(() => {
          scrollToMessage(lastMsgId);
        });
      }, 300); // Tăng delay để đảm bảo render hoàn thành

      return () => clearTimeout(renderTimer);
    } else {
      // Không chuyển chat, enable animations cho messages mới
      setShouldAnimate(true);
      setIsSwitchingChat(false);
    }
  }, [messages.length, chatId]);

  // Theo dõi khi messages được load xong để tắt loading state
  useEffect(() => {
    if (isSwitchingChat && messages.length > 0) {
      // Delay nhẹ để đảm bảo DOM được render
      const timer = setTimeout(() => {
        setIsSwitchingChat(false);
        setShouldAnimate(true);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isSwitchingChat]);

  // Tách logic kiểm tra tin nhắn mới thành useEffect riêng với loading state
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchedServerMessageIdRef = useRef<string | null>(null);
  const hasInitialFetchRef = useRef(false); // Track initial fetch

  // việc gọi tin nhắn mới từ api dùng để lấy dùng để khi vào phòng tải những tin nhắn mới trong lúc offline
  useEffect(() => {
    // Nếu không có tin nhắn local, lấy 100 tin nhắn đầu tiên từ API
    if (messages.length === 0 && !hasInitialFetchRef.current) {
      console.log(
        "📥 Không có tin nhắn local, lấy 100 tin nhắn đầu tiên từ API"
      );
      hasInitialFetchRef.current = true;
      setIsFetchingNewMessages(true);

      messageState
        .fetchMessagesFromAPI(chatId, { limit: 100 })
        .then((fetchedMessages) => {
          console.log(`✅ Đã tải ${fetchedMessages.length} tin nhắn từ API`);
        })
        .catch((error) => {
          console.error("❌ Lỗi khi tải tin nhắn từ API:", error);
        })
        .finally(() => {
          setIsFetchingNewMessages(false);
        });

      return;
    }

    // Reset flag khi chuyển chat
    if (prevChatIdRef.current !== chatId) {
      hasInitialFetchRef.current = false;
    }

    // Bỏ qua nếu chưa có room
    if (!roomState.room?.last_message?.id) {
      return;
    }

    const lastLocalMessageId = messages.at(-1)?.id;
    const lastServerMessageId = roomState.room.last_message.id;

    // Bỏ qua nếu không có messages local hoặc đã fetch server message này rồi
    if (
      !lastLocalMessageId ||
      lastFetchedServerMessageIdRef.current === lastServerMessageId
    ) {
      return;
    }

    // Kiểm tra tin nhắn mới từ server
    if (lastServerMessageId !== lastLocalMessageId) {
      // Clear timeout cũ nếu có
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      // Debounce việc fetch để tránh gọi API liên tục - GIẢM DELAY CHO TIN NHẮN MỚI
      fetchTimeoutRef.current = setTimeout(async () => {
        console.log("🔄 Phát hiện tin nhắn mới từ server:", {
          serverLastId: lastServerMessageId,
          localLastId: lastLocalMessageId,
          messagesCount: messages.length,
          chatId,
        });

        // Set loading state
        setIsFetchingNewMessages(true);

        // Đánh dấu đã fetch server message này
        lastFetchedServerMessageIdRef.current = lastServerMessageId;

        try {
          // Fetch tin nhắn mới
          await messageState.fetchNewMessages(chatId, lastLocalMessageId);
          console.log("✅ Đã tải tin nhắn mới thành công");
        } catch (error) {
          console.error("❌ Lỗi khi tải tin nhắn mới:", error);
        } finally {
          // Clear loading state
          setIsFetchingNewMessages(false);
        }
      }, 100); // GIẢM từ 500ms xuống 100ms để tin nhắn mới hiện nhanh hơn
    }

    // Cleanup timeout khi unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [chatId, messages.length, roomState.room?.last_message?.id]);

  // Virtual scrolling: chỉ render một số messages gần nhất
  const visibleMessages = useMemo(() => {
    // Lấy tin nhắn mới nhất (từ cuối lên), giới hạn theo displayedMessagesCount
    return messages.slice(-displayedMessagesCount);
  }, [messages, displayedMessagesCount]);

  // Group lại visible messages
  const visibleGroups = useMemo(() => {
    return groupMessagesByDate(visibleMessages, lastMsgId);
  }, [visibleMessages, lastMsgId]);

  const hasMoreLocalMessages = displayedMessagesCount < messages.length;
  const hasLoadedAllLocal = messages.length > 0 && !hasMoreLocalMessages;

  // Optimized scroll detection với throttle - Fixed version
  useEffect(() => {
    const container = containerRef.current;
    if (!container || isSwitchingChat) return; // Skip khi đang chuyển chat

    let ticking = false;
    let scrollTimeout: NodeJS.Timeout | null = null;

    const checkScrollPosition = () => {
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;

      // Check bottom - threshold 50px để dễ trigger hơn
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isAtBottom = distanceFromBottom <= 50;

      // Check top - threshold 50px
      const isAtTop = scrollTop <= 50;

      // Chỉ update state khi có thay đổi
      if (isAtBottom !== isBottomVisible) {
        setIsBottomVisible(isAtBottom);
        console.log("🎯 Bottom visible:", isAtBottom);
      }

      if (isAtTop !== isTopVisible) {
        setIsTopVisible(isAtTop);
        console.log("🔝 Top visible:", isAtTop);
      }

      ticking = false;
    };

    const handleLoadMore = () => {
      if (isLoadingOlder || isSwitchingChat) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop <= 50;
      const hasScroll = scrollHeight > clientHeight + 10;

      if (isAtTop && hasScroll) {
        // Clear timeout cũ
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        scrollTimeout = setTimeout(() => {
          // Nếu còn messages trong local
          if (hasMoreLocalMessages && !isLoadingOlder) {
            console.log("📥 Load more messages from local...");
            setIsLoadingOlder(true);

            // Lưu scroll position trước khi load
            const scrollHeightBefore = container.scrollHeight;

            // Load thêm tin nhắn từ local
            setTimeout(() => {
              setDisplayedMessagesCount((prev) =>
                Math.min(prev + MESSAGES_PER_GROUP, messages.length)
              );
              setIsLoadingOlder(false);

              // Restore scroll position sau khi render
              requestAnimationFrame(() => {
                if (container) {
                  const scrollHeightAfter = container.scrollHeight;
                  const scrollDiff = scrollHeightAfter - scrollHeightBefore;
                  container.scrollTop += scrollDiff;
                  console.log("📍 Adjusted scroll by:", scrollDiff);
                }
              });
            }, 200);
          }
          // Nếu đã hết local, gọi API
          else if (
            hasLoadedAllLocal &&
            !isLoadingFromAPI &&
            hasMoreOnServer &&
            !isLoadingOlder
          ) {
            console.log("🌐 Load more messages from API...");
            setIsLoadingOlder(true);
            setIsLoadingFromAPI(true);
            hasTriedLoadingFromServer.current = true;

            // Gọi API load tin nhắn cũ hơn
            messageState
              .loadOlderMessages(chatId)
              .then((result: any) => {
                setIsLoadingOlder(false);
                setIsLoadingFromAPI(false);

                // Nếu API không trả về tin nhắn nào, đánh dấu hết
                if (!result || (Array.isArray(result) && result.length === 0)) {
                  setHasMoreOnServer(false);
                  console.log("✅ Reached end of messages from server");
                }
              })
              .catch((error: any) => {
                console.error("Failed to load older messages:", error);
                setIsLoadingOlder(false);
                setIsLoadingFromAPI(false);
              });
          }
        }, 300); // Debounce 300ms
      }
    };

    const handleScroll = () => {
      if (!ticking && container) {
        globalThis.requestAnimationFrame(() => {
          checkScrollPosition();
        });
        ticking = true;
      }

      // Handle load more separately
      handleLoadMore();
    };

    // Initial check
    checkScrollPosition();

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [
    isBottomVisible,
    isTopVisible,
    isLoadingOlder,
    hasMoreLocalMessages,
    hasLoadedAllLocal,
    isLoadingFromAPI,
    hasMoreOnServer,
    displayedMessagesCount,
    chatId,
    isSwitchingChat,
    MESSAGES_PER_GROUP,
  ]);

  /** 🎯 Khi có tin nhắn mới → cuộn xuống nếu đang ở gần đáy */
  useEffect(() => {
    if (isSwitchingChat) return; // Skip khi đang chuyển chat

    const hasNewMessages = messages.length > prevMessageCountRef.current;

    if (hasNewMessages && isBottomVisible && bottomRef.current) {
      // Loại bỏ delay - scroll ngay lập tức cho tin nhắn mới
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }

    prevMessageCountRef.current = messages.length;
  }, [messages.length, isBottomVisible, isSwitchingChat]);

  // Xử lý khi có tin nhắn mới được thêm vào local store - OPTIMIZED FOR SPEED
  useEffect(() => {
    if (isSwitchingChat) return;

    const currentMessageCount = messages.length;
    const hasNewMessages = currentMessageCount > prevMessageCountRef.current;

    if (hasNewMessages) {
      const newMessage = messages.at(-1);

      console.log("📨 Có tin nhắn mới được thêm:", {
        messageId: newMessage?.id,
        sender: newMessage?.sender?.fullname,
        isMine: newMessage?.isMine,
        isAtBottom: isBottomVisible,
        totalCount: currentMessageCount,
      });

      // PRIORITY: Cập nhật displayedMessages NGAY để tin nhắn hiện ngay lập tức
      if (displayedMessagesCount < currentMessageCount) {
        setDisplayedMessagesCount(
          Math.max(currentMessageCount, MESSAGES_PER_GROUP)
        );
      }

      // Tự động cuộn xuống nếu đang ở gần đáy hoặc tin nhắn là của mình
      if ((isBottomVisible || newMessage?.isMine) && bottomRef.current) {
        // Tin nhắn của mình: scroll ngay lập tức, không delay
        if (newMessage?.isMine) {
          bottomRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        } else {
          // Tin nhắn người khác: 1 frame delay để đảm bảo DOM update
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({
              behavior: "auto", // auto thay vì smooth để nhanh hơn
              block: "end",
            });
          });
        }
      }

      // Đã cập nhật displayedMessagesCount ở trên rồi, không cần lặp lại
    }

    prevMessageCountRef.current = currentMessageCount;
  }, [
    messages,
    isBottomVisible,
    displayedMessagesCount,
    isSwitchingChat,
    MESSAGES_PER_GROUP,
  ]);

  /** 🎯 Điều hướng cuộn: scrollToTop, scrollToBottom, scrollToId - Memoized */
  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const scrollToMessage = useCallback((id: string) => {
    const el = document.querySelector(`[data-mid="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  // Helper functions for message actions - Memoized for performance
  const canRecallMessage = useCallback((msg: any) => {
    if (!msg.isMine) return false;
    const sentAt = new Date(msg.createdAt).getTime();
    const now = Date.now();
    const diffMs = now - sentAt;
    const diffMins = diffMs / (1000 * 60);
    return diffMins < 30; // Có thể thu hồi trong 30 phút
  }, []);

  const handleReply = useCallback((msg: any) => {
    setReplyingTo(msg);
    // TODO: Scroll to input and focus
  }, []);

  const handleReact = useCallback((msg: any) => {
    // TODO: Open emoji picker for reactions
    console.log("React to message:", msg.id);
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    // TODO: Show toast notification
    console.log("Copied!");
  }, []);

  const handleDelete = useCallback(
    (msg: any) => {
      // TODO: Show confirmation and delete
      messageState.deleteMessage(chatId, msg.id);
      console.log("Deleted message:", msg.id);
    },
    [messageState, chatId]
  );

  const handleRecall = useCallback(
    (msg: any) => {
      if (!canRecallMessage(msg)) {
        console.log("Cannot recall message after 30 minutes");
        return;
      }
      // TODO: Show confirmation and recall
      messageState.recallMessage(chatId, msg.id);
      console.log("Recalled message:", msg.id);
    },
    [messageState, chatId, canRecallMessage]
  );

  const { setMessageRef, lastReadId } = useReadProgress({
    messages, // ASC time
    container: containerRef.current, // nếu scroll trong div
    stickyBottomPx: 0, // chiều cao sticky dưới (nếu có)
    minVisibleRatio: 0.5, // thấy >=50% coi như đã đọc
    onCommit: (id: string) => {
      console.log("🚀 ~ ChatMessages ~ id:", id);
      if (id > lastMsgId) {
        console.log("Đã đọc tới:", id);
      }
    }, // debounce 180ms
  });
  useEffect(() => {
    if (lastReadId > lastMsgId) {
      console.log("🚀 ~ đã đọc tới:", lastReadId);
      roomState.markMessageAsRead(chatId, lastReadId, socket);
    }
  }, [lastReadId]);
  return (
    <>
      {/* Loading overlay với Skeleton khi chuyển chat */}
      <AnimatePresence>
        {isSwitchingChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col"
          >
            {/* Skeleton messages */}
            <div className="flex-1 p-4 space-y-6 overflow-hidden">
              {/* Date divider skeleton */}
              <div className="flex items-center justify-center">
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>

              {/* Message skeletons */}
              {Array.from({ length: 5 }, (_, idx) => {
                const isMyMessage = idx % 2 === 1;
                const messageWidth = `${Math.floor(Math.random() * 40) + 60}%`;
                const uniqueKey = `chat-switch-skeleton-${chatId}-${idx}`;

                return (
                  <div
                    key={uniqueKey}
                    className={`flex gap-3 ${
                      isMyMessage ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Avatar skeleton cho tin người khác */}
                    {!isMyMessage && (
                      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    )}

                    {/* Message bubble skeleton */}
                    <div
                      className={`flex flex-col ${
                        isMyMessage ? "items-end" : "items-start"
                      } max-w-xs`}
                    >
                      {/* Sender name skeleton cho tin người khác */}
                      {!isMyMessage && idx === 0 && (
                        <Skeleton className="h-3 w-20 rounded mb-1" />
                      )}

                      {/* Content skeleton */}
                      <Skeleton
                        className={`h-10 rounded-2xl ${
                          isMyMessage ? "rounded-tr-md" : "rounded-tl-md"
                        }`}
                        style={{ width: messageWidth }}
                      />

                      {/* Timestamp skeleton */}
                      <Skeleton className="h-3 w-12 rounded mt-1" />
                    </div>

                    {/* Avatar skeleton cho tin của mình */}
                    {isMyMessage && (
                      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Loading indicator */}
            <div className="flex items-center justify-center py-6 bg-gradient-to-t from-white/50 to-transparent">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-200 border-t-blue-600"></div>
                <Skeleton className="h-4 w-40 rounded" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!isSwitchingChat && (
        <ScrollShadow
          ref={containerRef}
          className={`p-4 overflow-y-auto w-full max-h-[calc(100vh-180px)] transition-all duration-200 ${
            isFetchingNewMessages ? "bg-blue-50/20" : ""
          } ${isSwitchingChat ? "relative" : ""}`}
        >
          {/* Top marker + loading indicator */}
          <div ref={topRef} className="relative">
            <AnimatePresence>
              {isLoadingOlder && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex justify-center py-2"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                    <span>
                      {isLoadingFromAPI
                        ? "Đang tải từ server..."
                        : "Đang tải tin nhắn cũ..."}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Loading indicator for new messages với Skeleton */}
          <AnimatePresence>
            {isFetchingNewMessages && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4 py-3 mb-2"
              >
                {/* Loading banner */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-4 py-2 rounded-full shadow-sm border border-blue-200">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="font-medium">
                      Đang tải tin nhắn mới...
                    </span>
                  </div>
                </div>

                {/* Preview skeleton cho tin nhắn sẽ tới */}
                <div className="flex gap-3 justify-start px-4">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex flex-col">
                    <Skeleton className="h-3 w-16 rounded mb-2" />
                    <Skeleton className="h-8 w-32 rounded-2xl rounded-tl-md" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info hiển thị trạng thái */}
          {hasMoreLocalMessages && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-2 mb-2"
            >
              <div className="text-xs text-gray-400">
                📜 Còn {messages.length - displayedMessagesCount} tin nhắn cũ
                hơn • Cuộn lên để tải thêm
              </div>
            </motion.div>
          )}

          {/* Messages container - ẩn khi đang chuyển chat */}
          <motion.div
            animate={{
              opacity: isSwitchingChat ? 0 : 1,
              y: isSwitchingChat ? 10 : 0,
            }}
            transition={{ duration: 0.2 }}
          >
            {/* Timeline grouping - chỉ render visible messages */}
            {visibleGroups.length === 0 &&
              !isFetchingNewMessages &&
              !messageState.isLoading &&
              !isSwitchingChat && (
                <div className="text-center text-gray-500 mt-10">
                  <div className="mb-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <FaceSmileIcon className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                  <p className="text-lg font-medium">Chưa có tin nhắn nào</p>
                  <p className="text-sm mt-1">Bắt đầu trò chuyện thôi!</p>
                </div>
              )}

            {/* Loading state với Skeleton khi đang tải messages ban đầu */}
            {visibleGroups.length === 0 &&
              (isFetchingNewMessages || messageState.isLoading) &&
              !isSwitchingChat && (
                <div className="space-y-6 mt-6">
                  {/* Date divider skeleton */}
                  <div className="flex items-center justify-center">
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>

                  {/* Messages skeleton */}
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

                  {/* Loading text skeleton */}
                  <div className="text-center mt-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent mx-auto mb-3"></div>
                    <Skeleton className="h-4 w-32 rounded mx-auto" />
                  </div>
                </div>
              )}

            {visibleGroups.map((group, groupIdx) => (
              <div
                key={`message-group-${group.dateLabel}-${groupIdx}`}
                className="space-y-4"
              >
                {/* Date divider */}
                <motion.div
                  initial={shouldAnimate ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldAnimate ? 0.3 : 0 }}
                  className="flex items-center justify-center my-4"
                >
                  <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
                    {group.dateLabel}
                  </div>
                </motion.div>

                {/* Messages in this date group */}
                <AnimatePresence initial={false}>
                  {group.messages.map((msg, msgIdx) => {
                    const isFirstInGroup = msgIdx === 0;
                    const isLastInGroup = msgIdx === group.messages.length - 1;
                    const prevMsg =
                      msgIdx > 0 ? group.messages[msgIdx - 1] : null;
                    const nextMsg =
                      msgIdx < group.messages.length - 1
                        ? group.messages[msgIdx + 1]
                        : null;

                    // Kiểm tra có phải tin liên tiếp từ cùng người không
                    const isSameSenderAsPrev =
                      prevMsg?.sender._id === msg.sender._id;
                    const isSameSenderAsNext =
                      nextMsg?.sender._id === msg.sender._id;

                    // Quyết định có hiện avatar không
                    const showAvatar = !isSameSenderAsNext || isLastInGroup;

                    // Quyết định margin
                    const messageSpacing = isSameSenderAsPrev ? "mt-1" : "mt-4";

                    // Check if message is new (chưa render)
                    const isNewMessage = !renderedMessageIds.current.has(
                      msg.id
                    );
                    if (!renderedMessageIds.current.has(msg.id)) {
                      renderedMessageIds.current.add(msg.id);
                    }

                    // Chỉ animate messages mới
                    const shouldAnimateThis = shouldAnimate && isNewMessage;

                    return (
                      <motion.div
                        key={msg.id}
                        initial={
                          shouldAnimateThis
                            ? {
                                opacity: 0,
                                x: msg.isMine ? 20 : -20,
                                scale: 0.95,
                              }
                            : false
                        }
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={
                          shouldAnimateThis
                            ? { opacity: 0, scale: 0.95 }
                            : undefined
                        }
                        transition={{
                          duration: shouldAnimateThis ? 0.2 : 0, // Giảm từ 0.3 xuống 0.2s để tăng tốc
                          ease: "easeOut",
                        }}
                        className={messageSpacing}
                      >
                        {/* Divider "Tin nhắn mới" */}
                        {group.newMessageIndex === msgIdx &&
                          !msg.isRead &&
                          !msg.isMine && (
                            <motion.div
                              initial={
                                shouldAnimate
                                  ? { opacity: 0, scale: 0.8 }
                                  : false
                              }
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                duration: shouldAnimate ? 0.4 : 0,
                                ease: "easeOut",
                              }}
                              className="flex items-center gap-3 my-6"
                            >
                              <motion.div
                                initial={shouldAnimate ? { width: 0 } : false}
                                animate={{ width: "100%" }}
                                transition={{
                                  duration: shouldAnimate ? 0.6 : 0,
                                  delay: shouldAnimate ? 0.2 : 0,
                                }}
                                className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"
                              ></motion.div>
                              <motion.span
                                initial={shouldAnimate ? { scale: 0 } : false}
                                animate={{ scale: 1 }}
                                transition={
                                  shouldAnimate
                                    ? {
                                        duration: 0.4,
                                        delay: 0.3,
                                        type: "spring",
                                        stiffness: 200,
                                      }
                                    : { duration: 0 }
                                }
                                className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg"
                              >
                                ✨ Tin nhắn mới
                              </motion.span>
                              <motion.div
                                initial={shouldAnimate ? { width: 0 } : false}
                                animate={{ width: "100%" }}
                                transition={{
                                  duration: shouldAnimate ? 0.6 : 0,
                                  delay: shouldAnimate ? 0.2 : 0,
                                }}
                                className="flex-1 h-px bg-gradient-to-r from-transparent via-red-400 to-transparent"
                              ></motion.div>
                            </motion.div>
                          )}

                        <fieldset
                          ref={setMessageRef(msg.id)}
                          className={`flex items-end gap-2 group ${
                            msg.isMine ? "justify-end" : "justify-start"
                          }`}
                          data-mid={msg.id}
                        >
                          {/* Read avatars cho tin của mình (bên trái bubble) */}
                          {isLastInGroup &&
                            msg.isMine &&
                            msg.read_by_count > 0 && (
                              <div className="flex gap-1 items-end mb-1">
                                {msg.read_by.slice(0, 3).map((read_by: any) => (
                                  <Tooltip
                                    key={read_by.user.id}
                                    content={read_by.user.fullname || "User"}
                                    size="sm"
                                  >
                                    <Avatar
                                      src={read_by.user.avatar || undefined}
                                      className="w-3 h-3 ring-2 ring-white"
                                      name={read_by.user.fullname || "User"}
                                    />
                                  </Tooltip>
                                ))}
                                {msg.read_by_count > 3 && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    +{msg.read_by_count - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          <div
                            className={`flex w-full items-end gap-2 group ${
                              msg.isMine ? "justify-end" : "justify-start"
                            }`}
                          >
                            {/* Avatar bên trái (tin người khác) */}
                            {!msg.isMine && (
                              <div className="w-8 flex-shrink-0">
                                {showAvatar ? (
                                  <Avatar
                                    src={msg.sender.avatar || undefined}
                                    name={msg.sender.fullname || "User"}
                                    size="sm"
                                    className="w-8 h-8"
                                    isBordered
                                  />
                                ) : (
                                  <div className="w-8 h-8"></div>
                                )}
                              </div>
                            )}

                            {/* Message bubble */}
                            <div
                              className={`flex flex-col max-w-md ${
                                msg.isMine ? "items-end" : "items-start"
                              }`}
                            >
                              {/* Message actions menu - appear on hover */}

                              <div
                                className={` gap-3 flex justify-end items-center  ${
                                  !msg.isMine ? "flex-row-reverse" : ""
                                }`}
                              >
                                <div className="flex items-center">
                                  {/* <Button
                                    isIconOnly
                                    color="default"
                                    variant="bordered"
                                    className="w-3 h-3 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                  >
                                    <HeartIcon className="w-3 h-3" />
                                  </Button> */}
                                  <Popover placement="top">
                                    <PopoverTrigger>
                                      <Button
                                        className=" text-gray-400 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                        size="sm"
                                        variant="flat"
                                        isIconOnly
                                      >
                                        <FaceSmileIcon className="h-3 w-3" />
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent>dfsfs</PopoverContent>
                                  </Popover>
                                  <Button
                                    className=" text-gray-400 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                    size="sm"
                                    variant="flat"
                                    isIconOnly
                                  >
                                    <ArrowUturnLeftIcon className="h-3 w-3" />
                                  </Button>
                                  <Dropdown backdrop="blur">
                                    <DropdownTrigger>
                                      <Button
                                        className=" text-gray-400 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                        size="sm"
                                        variant="flat"
                                        isIconOnly
                                      >
                                        <ArrowUturnLeftIcon className="h-3 w-3" />
                                      </Button>
                                    </DropdownTrigger>
                                    <DropdownMenu
                                      aria-label="Static Actions"
                                      variant="faded"
                                    >
                                      <DropdownItem key="new">
                                        New file
                                      </DropdownItem>
                                      <DropdownItem key="copy">
                                        Copy link
                                      </DropdownItem>
                                      <DropdownItem key="edit">
                                        Edit file
                                      </DropdownItem>
                                      <DropdownItem
                                        key="delete"
                                        className="text-danger"
                                        color="danger"
                                      >
                                        Delete file
                                      </DropdownItem>
                                    </DropdownMenu>
                                  </Dropdown>
                                </div>
                                <div
                                  className={`flex flex-col ${
                                    msg.isMine ? "items-end" : "items-start"
                                  }`}
                                >
                                  {/* Tên người gửi (chỉ hiện cho tin đầu tiên trong nhóm và không phải tin của mình) */}
                                  {!msg.isMine && !isSameSenderAsPrev && (
                                    <span className="text-xs text-gray-500 mb-1 ml-3 font-medium">
                                      {msg.sender.fullname || "User"}
                                    </span>
                                  )}

                                  {/* Attachments */}
                                  {msg.attachments &&
                                    msg.attachments.length > 0 && (
                                      <div className="mb-2">
                                        <CompactFileGallery
                                          files={msg.attachments}
                                          maxDisplay={2}
                                          className="w-full"
                                        />
                                      </div>
                                    )}
                                  {/* Message actions - hiển thị khi hover ở vị trí phù hợp */}

                                  {/* Content bubble */}
                                  {msg.content && (
                                    <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
                                      <div
                                        className={`
                        relative px-4 py-2.5 rounded-2xl shadow-sm
                        ${
                          msg.isMine
                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                            : "bg-white text-gray-800 border border-gray-200"
                        }
                        ${
                          !isSameSenderAsPrev && msg.isMine
                            ? "rounded-tr-md"
                            : ""
                        }
                        ${
                          !isSameSenderAsPrev && !msg.isMine
                            ? "rounded-tl-md"
                            : ""
                        }
                        ${
                          !isSameSenderAsNext && msg.isMine
                            ? "rounded-br-md"
                            : ""
                        }
                        ${
                          !isSameSenderAsNext && !msg.isMine
                            ? "rounded-bl-md"
                            : ""
                        }
                        ${
                          msg.status === "pending" || msg.status === "uploading"
                            ? "opacity-60"
                            : ""
                        }
                        ${
                          msg.status === "failed"
                            ? "opacity-80 border-2 border-red-400"
                            : ""
                        }
                      `}
                                      >
                                        {(() => {
                                          const MAX_LENGTH = 300;
                                          const isExpanded =
                                            expandedMessages.has(msg.id);
                                          const isLongMessage =
                                            msg.content.length > MAX_LENGTH;
                                          const displayContent =
                                            isLongMessage && !isExpanded
                                              ? msg.content.slice(
                                                  0,
                                                  MAX_LENGTH
                                                ) + "..."
                                              : msg.content;

                                          return (
                                            <>
                                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                {displayContent}
                                              </p>

                                              {/* Nút xem thêm/thu gọn */}
                                              {isLongMessage && (
                                                <button
                                                  onClick={() => {
                                                    setExpandedMessages(
                                                      (prev) => {
                                                        const newSet = new Set(
                                                          prev
                                                        );
                                                        if (isExpanded) {
                                                          newSet.delete(msg.id);
                                                        } else {
                                                          newSet.add(msg.id);
                                                        }
                                                        return newSet;
                                                      }
                                                    );
                                                  }}
                                                  className={`text-xs mt-1 font-medium hover:underline ${
                                                    msg.isMine
                                                      ? "text-blue-100"
                                                      : "text-blue-600"
                                                  }`}
                                                >
                                                  {isExpanded
                                                    ? "Thu gọn"
                                                    : "Xem thêm"}
                                                </button>
                                              )}
                                            </>
                                          );
                                        })()}

                                        {/* Pinned icon */}
                                        {msg.pinned && (
                                          <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1 shadow-md">
                                            <EyeDropperIcon className="w-3 h-3 text-white" />
                                          </div>
                                        )}

                                        {/* Uploading indicator */}
                                        {msg.status === "uploading" && (
                                          <div className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 shadow-md animate-pulse">
                                            <span className="text-white text-xs">
                                              ⏳
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Link Preview - hiển thị nếu có URL */}
                                      {(() => {
                                        const url = extractFirstUrl(
                                          msg.content
                                        );
                                        return url ? (
                                          <div className="mt-2">
                                            <LinkPreview
                                              url={url}
                                              isMine={msg.isMine}
                                            />
                                          </div>
                                        ) : null;
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Timestamp - chỉ hiện ở tin cuối nhóm */}
                              {showAvatar && (
                                <div
                                  className={`flex items-center gap-1 mt-1 ${
                                    msg.isMine ? "flex-row-reverse" : "flex-row"
                                  }`}
                                >
                                  {/* Failed status với nút gửi lại */}
                                  {msg.status === "failed" && msg.isMine && (
                                    <Button
                                      size="sm"
                                      color="danger"
                                      variant="flat"
                                      startContent={
                                        <span className="text-xs">⚠️</span>
                                      }
                                      onPress={() => {
                                        messageState.resendMessage(
                                          chatId,
                                          msg.id,
                                          socket
                                        );
                                      }}
                                      className="text-xs h-6 min-w-0 px-2"
                                    >
                                      Gửi lại
                                    </Button>
                                  )}

                                  <span className="text-xs text-gray-400">
                                    {formatMessageTime(msg.createdAt)}
                                  </span>
                                  {msg.isMine && msg.status !== "failed" && (
                                    <span className="text-xs text-gray-400">
                                      {msg.read_by_count > 0 ? "✓✓" : "✓"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Avatar bên phải (tin của mình) */}
                            {msg.isMine && (
                              <div className="w-8 flex-shrink-0">
                                {showAvatar ? (
                                  <Avatar
                                    src={msg.sender.avatar || undefined}
                                    name={msg.sender.fullname || "User"}
                                    size="sm"
                                    className="w-8 h-8"
                                    isBordered
                                  />
                                ) : (
                                  <div className="w-8 h-8"></div>
                                )}
                              </div>
                            )}
                          </div>

                          {!msg.isMine &&
                            msg.id === lastMsgId &&
                            msg.read_by_count > 0 && (
                              <div className="flex gap-1 items-end mb-1">
                                {msg.read_by.slice(0, 3).map((read_by: any) => (
                                  <Tooltip
                                    key={read_by.user.id}
                                    content={read_by.user.fullname || "User"}
                                    size="sm"
                                  >
                                    <Avatar
                                      src={read_by.user.avatar || undefined}
                                      className="w-3 h-3 ring-2 ring-white"
                                      name={read_by.user.fullname || "User"}
                                    />
                                  </Tooltip>
                                ))}
                                {msg.read_by_count > 3 && (
                                  <span className="text-xs text-gray-400 ml-1">
                                    +{msg.read_by_count - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          {/* <div>nnot isMine dropdown menu</div> */}
                        </fieldset>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>

          {/* Bottom marker với height để dễ detect */}
          <div ref={bottomRef} className="h-1 w-full" />

          {/* Loading indicator cho tin nhắn mới - floating ở góc phải */}
          <AnimatePresence>
            {(isFetchingNewMessages || messageState.isLoading) && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="fixed bottom-20 right-6 z-50"
              >
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm text-xs text-blue-600 px-3 py-2 rounded-full shadow-lg border border-blue-200">
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="font-medium whitespace-nowrap">
                    {isFetchingNewMessages
                      ? "Đang tải tin nhắn mới"
                      : "Đang tải..."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ScrollShadow>
      )}
      {/* Scroll to bottom button with animation */}
      <AnimatePresence>
        {!isBottomVisible && messages.length > 0 && !isSwitchingChat && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-40 right-40 z-40"
          >
            <Button
              onPress={scrollToBottom}
              color="primary"
              variant="shadow"
              isIconOnly
              className="shadow-lg hover:shadow-xl transition-shadow"
              size="lg"
            >
              <ChevronDoubleDownIcon className="w-5 h-5" />
            </Button>

            {/* Badge hiển thị số tin nhắn mới nếu có */}
            {/* {messages.length > displayedMessagesCount && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {messages.length - displayedMessagesCount > 99
                  ? "99+"
                  : messages.length - displayedMessagesCount}
              </div>
            )} */}
            {!roomState?.room?.is_read && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                {(roomState?.room?.unread_count ?? 0) > 99
                  ? "99+"
                  : roomState?.room?.unread_count ?? 0}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

// Set displayName cho debugging
ChatMessages.displayName = "ChatMessages";

// ...existing code...
