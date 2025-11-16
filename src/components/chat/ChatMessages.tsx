"use client";
import { useReadProgress } from "@/libs/useReadProgress";
import useMessageStore from "@/store/useMessageStore";
import {
  ChevronDoubleDownIcon,
  EyeDropperIcon,
  EllipsisVerticalIcon,
  ArrowUturnLeftIcon,
  FaceSmileIcon,
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
import useToast from "@/hooks/useToast";
import { motion, AnimatePresence } from "framer-motion";
import { MessageType } from "@/store/types/message.state";

// Small constants/helpers to reduce repetition and file length
const EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "😡",
  "🎉",
  "🔥",
  "👏",
  "💯",
  "🙏",
  "👀",
];

function ReplyPreview({
  reply,
  onJump,
}: {
  reply: any;
  onJump: (id: string) => void;
}) {
  if (!reply) return null;

  // Field mapping:
  // - reply.isDeleted (or reply.status === 'recalled') => message was recalled (thu hồi)
  // - reply.hiddenByMe => message was deleted by me (xoá)
  const isRecalled = !!reply.isDeleted || reply.status === "recalled";
  const isDeleted = !!reply.hiddenByMe;

  const badge =
    reply.type !== "text" && !isDeleted && !isRecalled ? (
      <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
        {reply.type === "image" && "📷 Ảnh"}
        {reply.type === "video" && "🎥 Video"}
        {reply.type === "file" && "📎 File"}
        {reply.type === "gif" && "🎬 GIF"}
      </span>
    ) : null;

  let previewText: string;
  if (isDeleted) {
    // Deleted by me
    previewText = "Tin nhắn đã bị xoá";
  } else if (isRecalled) {
    // Recalled (thu hồi)
    if (reply.isMine) {
      previewText = "Bạn đã thu hồi tin nhắn này";
    } else {
      previewText = "Tin nhắn đã bị thu hồi";
    }
  } else if (reply.type === "text") {
    previewText = reply.content;
  } else {
    previewText = reply.attachments?.[0]?.name || "File đính kèm";
  }

  return (
    <button
      onClick={() => onJump(reply._id)}
      className={`mb-2 px-3 py-2 rounded-lg max-w-sm border-l-4 bg-gradient-to-r cursor-pointer transition-all duration-200 hover:scale-[1.02]`}
    >
      <div className="flex items-center gap-2 mb-1">
        <ArrowUturnLeftIcon className="h-3 w-3 text-teal-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-teal-600">
          {reply.isMine ? "Bạn" : reply.sender?.name || "Unknown"}
        </span>
        {badge}
      </div>
      <p className="text-sm text-gray-700 line-clamp-2 text-left">
        {previewText}
      </p>
    </button>
  );
}

export const ChatMessages = memo(
  ({ chatId, noAction }: { chatId: string; noAction: boolean }) => {
    // Performance monitoring
    const startTime = useRef(performance.now());

    useEffect(() => {
      const renderTime = performance.now() - startTime.current;
      if (renderTime > 100) {
        // Log slow renders
        // console.warn(`🐌 Slow ChatMessages render: ${renderTime.toFixed(2)}ms`);
      }
    });

    const { socket } = useSocket();
    const roomState = useRoomStore((state) => state);
    const messageState = useMessageStore((state) => state);
    const toast = useToast();
    const messages = messageState.messagesRoom[chatId]?.messages || [];
    // Compute the most up-to-date message id to use for grouping/scrolling.
    // Priority order:
    // 1. room.last_read_id (what server reports as last read)
    // 2. room.last_message.id (last message id known by room metadata)
    // 3. last local message id from the messages array
    // 4. fallback to "null" string
    const lastMsgId =
      roomState.room?.last_read_id ??
      roomState.room?.last_message?.id ??
      messages.at(-1)?.id ??
      "null";
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
      new Set()
    ); // Track expanded messages

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
        setDisplayedMessagesCount(MESSAGES_PER_GROUP); // Reset về 15 messages khi chuyển chat
        setHasMoreOnServer(true); // Reset server flag when switching chats
        hasTriedLoadingFromServer.current = false; // Reset tried flag
        setExpandedMessages(new Set()); // Reset expanded messages when switching chats

        setIsFetchingNewMessages(false); // Reset fetching state khi chuyển chat
        lastFetchedServerMessageIdRef.current = null; // Reset fetch tracking khi chuyển chat
        hasInitialFetchRef.current = {}; // Reset initial fetch flag khi chuyển chat

        setIsBottomVisible(false);

        // Load messages cho chat mới - QUAN TRỌNG: Đợi load xong rồi mới render
        messageState
          .getMessageByRoomId(chatId)
          .then(() => {
            // Delay ngắn để đảm bảo messages được load và render xong
            requestAnimationFrame(() => {
              setShouldAnimate(true);
              setIsSwitchingChat(false);

              // Scroll sau khi render xong
              requestAnimationFrame(() => {
                scrollToMessage(lastMsgId);
              });
            });
          })
          .catch(() => {
            setIsSwitchingChat(false);
            setShouldAnimate(true);
          });
      }

      // Không return cleanup function ở đây để tránh cancel loading
    }, [chatId]); // CHỈ depend vào chatId, không depend vào messages.length

    // Theo dõi khi messages được load xong để tắt loading state
    useEffect(() => {
      // Chỉ chạy khi đang switching và messages đã có data
      if (isSwitchingChat && messages.length > 0) {
        // Delay nhẹ để đảm bảo DOM được render
        const timer = setTimeout(() => {
          setIsSwitchingChat(false);
          setShouldAnimate(true);
        }, 100);

        return () => clearTimeout(timer);
      }
    }, [messages.length, isSwitchingChat]); // Depend vào cả messages.length và isSwitchingChat

    // Tách logic kiểm tra tin nhắn mới thành useEffect riêng với loading state
    const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastFetchedServerMessageIdRef = useRef<string | null>(null);
    const hasInitialFetchRef = useRef<Record<string, boolean>>({}); // Track initial fetch per chatId

    /**
     * useEffect #1: Load tin nhắn ban đầu nếu local chưa có
     * Xảy ra khi: User mới login, xóa cache, chuyển thiết bị
     */
    useEffect(() => {
      // TRƯỜNG HỢP 1: Không có tin nhắn local → Lấy 100 tin nhắn đầu tiên từ API
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
            // Reset flag để có thể thử lại
            hasInitialFetchRef.current[chatId] = false;
          });
      }
    }, [chatId, messages.length]); // Dependency array cố định

    /**
     * useEffect #2: Đồng bộ tin nhắn mới từ server
     * Xảy ra khi: User offline rồi quay lại, có tin nhắn mới khi inactive
     */
    useEffect(() => {
      // Bỏ qua nếu chưa có room info từ server
      if (!roomState.room?.last_message?.id) {
        return;
      }

      const lastLocalMessageId = messages.at(-1)?.id;
      const lastServerMessageId = roomState.room.last_message.id;

      // Bỏ qua nếu không có messages local
      if (!lastLocalMessageId) {
        return;
      }

      // Bỏ qua nếu đã fetch server message này rồi
      if (lastFetchedServerMessageIdRef.current === lastServerMessageId) {
        return;
      }

      // TRƯỜNG HỢP 2: Có tin nhắn mới từ server → Fetch tin nhắn bị missed
      if (lastServerMessageId !== lastLocalMessageId) {
        // Clear timeout cũ nếu có
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }

        // Debounce việc fetch để tránh gọi API liên tục
        fetchTimeoutRef.current = setTimeout(async () => {
          // Set loading state
          setIsFetchingNewMessages(true);

          // Đánh dấu đã fetch server message này
          lastFetchedServerMessageIdRef.current = lastServerMessageId;

          try {
            // Fetch tin nhắn mới từ lastLocalMessageId đến lastServerMessageId
            await messageState.fetchNewMessages(chatId, lastLocalMessageId);
          } catch {
            // Reset để có thể thử lại
            lastFetchedServerMessageIdRef.current = null;
          } finally {
            // Clear loading state
            setIsFetchingNewMessages(false);
          }
        }, 100);
      }

      // Cleanup timeout khi unmount hoặc dependencies thay đổi
      return () => {
        if (fetchTimeoutRef.current) {
          clearTimeout(fetchTimeoutRef.current);
        }
      };
    }, [chatId, messages.length, roomState.room?.last_message?.id]); // Dependencies cố định: luôn là 3 items

    /**
     * useEffect #3: Lắng nghe socket reconnect và fetch tin nhắn mới
     * Xảy ra khi: Socket reconnect sau khi mất kết nối
     */
    useEffect(() => {
      if (!socket) return;

      const handleReconnect = () => {
        // Đợi một chút để đảm bảo socket đã hoàn toàn kết nối
        setTimeout(async () => {
          try {
            setIsFetchingNewMessages(true);

            // Lấy tin nhắn mới nhất từ server (50 tin nhắn gần đây nhất)
            await messageState.fetchMessagesFromAPI(chatId, { limit: 50 });

            // Scroll xuống cuối để hiển thị tin nhắn mới nhất
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
        }, 500); // Đợi 500ms để socket ổn định
      };

      // Lắng nghe sự kiện reconnect
      socket.on("connect", handleReconnect);

      // Cleanup
      return () => {
        socket.off("connect", handleReconnect);
      };
    }, [socket, chatId, messageState]);

    // Virtual scrolling: chỉ render một số messages gần nhất
    const visibleMessages = useMemo(() => {
      // Lấy tin nhắn mới nhất (từ cuối lên), loại bỏ những tin đã ẩn bởi user (hiddenByMe)
      // Previously we filtered out messages with hiddenByMe so deleted-by-me messages
      // were hidden entirely. Keep them so we can render a deleted-placeholder
      // (e.g. "Bạn đã xoá tin nhắn này"). Other UI logic already hides actions/attachments
      // for such messages.
      const visible = messages || [];
      return visible.slice(-displayedMessagesCount);
    }, [messages, displayedMessagesCount]);

    // Group lại visible messages
    const visibleGroups = useMemo(() => {
      return groupMessagesByDate(visibleMessages, lastMsgId);
    }, [visibleMessages, lastMsgId]);

    const hasMoreLocalMessages = displayedMessagesCount < messages.length;
    const hasLoadedAllLocal = messages.length > 0 && !hasMoreLocalMessages;
    // Robust handleLoadMore: no-arg function that reads current container via ref
    // and uses a local debounce ref (`loadingTimeoutRef`) to avoid duplicate timers.
    // It supports both loading from local IndexedDB and falling back to server.
    const handleLoadMore = (force = false) => {
      // Prevent concurrent loads or when switching chat
      if (isLoadingOlder || isSwitchingChat) return;

      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtTop = scrollTop <= 50;
      const hasScroll = scrollHeight > clientHeight + 10;

      if (!isAtTop && !force) return;
      if (!hasScroll && !force) return;

      // Debounce using loadingTimeoutRef defined above
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      loadingTimeoutRef.current = setTimeout(async () => {
        try {
          // If we still have more messages locally, expand the window
          if (hasMoreLocalMessages) {
            setIsLoadingOlder(true);

            const scrollHeightBefore = container.scrollHeight;

            // Expand count briefly (use a micro-delay to let React batch updates)
            setTimeout(() => {
              setDisplayedMessagesCount((prev) =>
                Math.min(prev + MESSAGES_PER_GROUP, messages.length)
              );
              setIsLoadingOlder(false);

              // Restore scroll position after DOM updates
              requestAnimationFrame(() => {
                const scrollHeightAfter = container.scrollHeight;
                const scrollDiff = scrollHeightAfter - scrollHeightBefore;
                container.scrollTop += scrollDiff;
              });
            }, 120);

            return;
          }

          // No more local messages -> try server if allowed
          if (hasLoadedAllLocal && !isLoadingFromAPI && hasMoreOnServer) {
            setIsLoadingOlder(true);
            setIsLoadingFromAPI(true);
            hasTriedLoadingFromServer.current = true;

            try {
              const result: any = await messageState.loadOlderMessages(chatId);
              setIsLoadingOlder(false);
              setIsLoadingFromAPI(false);

              if (!result || (Array.isArray(result) && result.length === 0)) {
                setHasMoreOnServer(false);
              }
            } catch (error: any) {
              console.error("Failed to load older messages:", error);
              setIsLoadingOlder(false);
              setIsLoadingFromAPI(false);
            }
          }
        } finally {
          // clear debounce timer
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }
        }
      }, 300);
    };
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
        }

        if (isAtTop !== isTopVisible) {
          setIsTopVisible(isAtTop);
        }

        ticking = false;
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
          bottomRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
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

        // PRIORITY: Cập nhật displayedMessages NGAY để tin nhắn hiện ngay lập tức
        if (displayedMessagesCount < currentMessageCount) {
          setDisplayedMessagesCount(
            Math.max(currentMessageCount, MESSAGES_PER_GROUP)
          );
        }

        // Tự động cuộn xuống - TIN NHẮN CỦA MÌNH LUÔN SCROLL
        if (newMessage?.isMine) {
          // Đợi một chút để đảm bảo tin nhắn đã render xong
          setTimeout(() => {
            if (containerRef.current) {
              // Scroll container xuống bottom hoàn toàn
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            } else if (bottomRef.current) {
              // Fallback: dùng scrollIntoView
              bottomRef.current.scrollIntoView({
                behavior: "smooth",
                block: "end",
              });
              // console.log("✅ Scrolled to bottom using bottomRef");
            } else {
              // console.warn("⚠️ Both containerRef and bottomRef are null");
            }
          }, 150); // Tăng delay lên 150ms để đảm bảo DOM render xong
        } else if (isBottomVisible && bottomRef.current) {
          // Tin nhắn người khác: chỉ scroll nếu đang ở gần đáy
          // console.log("📥 Tin nhắn người khác - Scroll vì đang ở bottom");
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop =
                containerRef.current.scrollHeight;
            } else if (bottomRef.current) {
              bottomRef.current.scrollIntoView({
                behavior: "smooth",
                block: "end",
              });
            }
          });
        } else {
          // console.log("⏭️ Không scroll - Tin nhắn người khác và không ở bottom");
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
      if (containerRef.current) {
        // Scroll container xuống bottom hoàn toàn
        containerRef.current.scrollTo({
          top: containerRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else if (bottomRef.current) {
        // Fallback
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, []);

    const scrollToMessage = useCallback(
      async (id: string) => {
        // console.log("🎯 Scrolling to message:", id);

        // Helper function để highlight message
        const highlightMessage = (element: Element) => {
          element.classList.add("message-highlight-flash");
          setTimeout(() => {
            element.classList.remove("message-highlight-flash");
          }, 1000); // Remove after animation completes
        };

        // Kiểm tra element đã tồn tại chưa
        const el = document.querySelector(`[data-mid="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Add highlight after scroll
          setTimeout(() => highlightMessage(el), 500);
          return;
        }

        // Element chưa render - tìm index trong messages
        let messageIndex = messages.findIndex((msg) => msg.id === id);

        // CASE 1: Tin nhắn chưa có trong local → load từ server
        if (messageIndex === -1) {
          // console.warn(
          //   "⚠️ Message not found in local, trying to load from server..."
          // );

          // Scroll to top để chuẩn bị load
          if (containerRef.current) {
            containerRef.current.scrollTop = 0;
          }

          // Show loading state
          setIsLoadingOlder(true);

          try {
            // Load older messages cho đến khi tìm thấy hoặc hết
            let attempts = 0;
            const MAX_ATTEMPTS = 5; // Tối đa 5 lần load (5 * 100 = 500 messages)

            while (attempts < MAX_ATTEMPTS) {
              // console.log(
              //   `🌐 Loading older messages... (attempt ${
              //     attempts + 1
              //   }/${MAX_ATTEMPTS})`
              // );

              const result = await messageState.loadOlderMessages(chatId, 100);

              // Nếu không có tin nhắn nào trả về → đã hết
              if (!result || (Array.isArray(result) && result.length === 0)) {
                // console.warn(
                //   "❌ Reached end of server messages, target not found"
                // );
                setIsLoadingOlder(false);
                setHasMoreOnServer(false);
                return;
              }

              // Kiểm tra tin nhắn đã có trong messages chưa
              const currentMessages =
                messageState.messagesRoom[chatId]?.messages || [];
              messageIndex = currentMessages.findIndex((msg) => msg.id === id);

              if (messageIndex !== -1) {
                // console.log(
                //   `✅ Message found after loading! Index: ${messageIndex}`
                // );
                break; // Tìm thấy rồi, thoát loop
              }

              attempts++;
            }

            setIsLoadingOlder(false);

            // Nếu vẫn không tìm thấy sau MAX_ATTEMPTS
            if (messageIndex === -1) {
              // console.error("❌ Message not found after loading from server");
              return;
            }

            // Tin nhắn đã có trong messages, tiếp tục xử lý render + scroll
          } catch (error) {
            // console.error("❌ Error loading messages from server:", error);
            setIsLoadingOlder(false);
            return;
          }
        }

        // CASE 2: Tin nhắn có trong local nhưng chưa render
        // console.log(
        //   `📍 Message at index ${messageIndex}, current displayed: ${displayedMessagesCount}`
        // );

        // Lấy messages mới nhất từ store (có thể đã update từ loadOlderMessages)
        const currentMessages =
          messageState.messagesRoom[chatId]?.messages || messages;

        // Tính số messages cần hiển thị để bao gồm message target
        // +1 vì index bắt đầu từ 0, +MESSAGES_PER_GROUP để có context xung quanh
        const requiredCount = messageIndex + 1 + MESSAGES_PER_GROUP;

        if (requiredCount > displayedMessagesCount) {
          // console.log(
          //   `🔄 Expanding to ${requiredCount} messages to include target...`
          // );

          // Lưu scroll position hiện tại
          const currentScrollTop = containerRef.current?.scrollTop || 0;
          const currentScrollHeight = containerRef.current?.scrollHeight || 0;

          // Tăng số messages hiển thị
          setDisplayedMessagesCount(
            Math.min(requiredCount, currentMessages.length)
          );

          // Đợi render xong rồi scroll - với retry mechanism
          const waitForElementAndScroll = (retries = 5, delay = 100) => {
            requestAnimationFrame(() => {
              const newEl = document.querySelector(`[data-mid="${id}"]`);
              if (newEl) {
                // console.log("✅ Element rendered after expansion, scrolling...");

                // Adjust scroll position để giữ vị trí tương đối
                if (containerRef.current) {
                  const newScrollHeight =
                    containerRef.current.scrollHeight || 0;
                  const scrollDiff = newScrollHeight - currentScrollHeight;
                  containerRef.current.scrollTop =
                    currentScrollTop + scrollDiff;
                }

                // Scroll to target với delay nhỏ
                setTimeout(() => {
                  newEl.scrollIntoView({ behavior: "smooth", block: "center" });
                  // Add highlight after scroll
                  setTimeout(() => highlightMessage(newEl), 500);
                }, 100);
              } else if (retries > 0) {
                // console.log(
                //   `⏳ Waiting for element to render... (retries left: ${retries})`
                // );
                setTimeout(
                  () => waitForElementAndScroll(retries - 1, delay),
                  delay
                );
              } else {
                // console.warn(
                //   "⚠️ Element not found after expansion and retries. Message may not exist in view."
                // );
              }
            });
          };

          waitForElementAndScroll();
        } else {
          // Tin nhắn đã render rồi, scroll luôn - với retry mechanism
          const scrollToExisting = (retries = 3) => {
            requestAnimationFrame(() => {
              const targetEl = document.querySelector(`[data-mid="${id}"]`);
              if (targetEl) {
                targetEl.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                // Add highlight after scroll
                setTimeout(() => highlightMessage(targetEl), 500);
              } else if (retries > 0) {
                // console.log(
                //   `⏳ Element should be rendered, retrying... (${retries} left)`
                // );
                setTimeout(() => scrollToExisting(retries - 1), 100);
              } else {
                // console.warn(
                //   "⚠️ Element expected but not found in DOM. May need to expand display count."
                // );
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
      ]
    );

    // Helper functions for message actions - Memoized for performance
    const canRecallMessage = useCallback((msg: any) => {
      if (!msg.isMine) return false;
      const sentAt = new Date(msg.createdAt).getTime();
      const now = Date.now();
      const diffMs = now - sentAt;
      const diffMins = diffMs / (1000 * 60);
      return diffMins < 30; // Có thể thu hồi trong 30 phút
    }, []);

    const handleReply = useCallback(
      (msg: MessageType) => {
        useMessageStore.getState().setReplyMessage(chatId, msg);
        // TODO: Scroll to input and focus
      },
      [chatId]
    );

    const handleReact = useCallback(
      (msg: MessageType, emoji: string) => {
        if (!socket) {
          return;
        }

        if (!socket.connected) {
          return;
        }

        socket.emit(
          "message:emoji",
          {
            roomId: chatId,
            msgId: msg.id,
            emoji: emoji,
          },
          () => {}
        );
      },
      [chatId, socket]
    );

    // Helper to emit with ack and a timeout, returns a promise that resolves with ack or rejects
    const emitWithAck = useCallback(
      (event: string, payload: any, timeout = 5000) => {
        // This helper intentionally resolves with a standardized ack object
        // instead of rejecting the promise. This avoids unhandled promise
        // rejections in the UI and makes callers responsible for checking
        // ack.ok.
        return new Promise<any>((resolve) => {
          if (!socket) return resolve({ ok: false, error: "no-socket" });
          if (!socket.connected)
            return resolve({ ok: false, error: "socket-not-connected" });

          let done = false;
          const timer = setTimeout(() => {
            if (done) return;
            done = true;
            // Resolve with a timeout-shaped ack instead of rejecting
            resolve({ ok: false, error: "ack-timeout" });
          }, timeout);

          try {
            socket.emit(event, payload, (ack: any) => {
              if (done) return;
              done = true;
              clearTimeout(timer);
              // If server returns falsy ack, normalize it
              if (!ack) return resolve({ ok: false, error: "no-ack-or-falsy" });
              return resolve(ack);
            });
          } catch (err: any) {
            if (!done) {
              done = true;
              clearTimeout(timer);
              resolve({ ok: false, error: err?.message || String(err) });
            }
          }
        });
      },
      [socket]
    );

    const handleCopy = useCallback((content: string) => {
      navigator.clipboard.writeText(content);
    }, []);

    // Toggle expanded state for long messages (extracted to avoid deep inline nesting)
    const toggleExpanded = useCallback((id: string) => {
      setExpandedMessages((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      });
    }, []);

    const handleDelete = useCallback(
      (msg: any) => {
        if (!socket || !socket.connected) return;

        const original = { ...msg };

        const updated = {
          ...msg,
          hiddenByMe: true,
          roomId: msg.roomId || chatId,
        };

        // Optimistic update
        messageState.upsetMsg(updated);

        // Emit and reconcile on ack/error
        emitWithAck(
          "message:delete",
          {
            roomId: chatId,
            msgId: msg.id,
          },
          5000
        )
          .then((ack) => {
            console.debug("emit:message:delete ack:", ack, "msgId:", msg.id);
            if (!ack || ack?.ok === false) {
              // rollback
              messageState.upsetMsg(original);
              toast.error(ack?.reason || "Không thể xoá tin nhắn");
            } else {
              toast.success("Đã xoá tin nhắn");
            }
          })
          .catch((err) => {
            console.error("delete ack error", err);
            // rollback optimistic change
            messageState.upsetMsg(original);
            toast.error("Không thể kết nối tới máy chủ. Xoá không thành công.");
          });
      },
      [chatId, socket, emitWithAck, messageState, toast]
    );

    const handleRecall = useCallback(
      (msg: any) => {
        if (!canRecallMessage(msg)) return;
        if (!socket || !socket.connected) return;

        const original = { ...msg };

        // Optimistic local recall
        messageState.recallMessage(chatId, msg.id);
        const updated = {
          ...msg,
          isDeleted: true,
          roomId: msg.roomId || chatId,
        };
        messageState.upsetMsg(updated);

        emitWithAck(
          "message:recall",
          {
            roomId: chatId,
            msgId: msg.id,
            placeholder: "tin nhắn đã được thu hồi",
          },
          5000
        )
          .then((ack) => {
            console.debug("emit:message:recall ack:", ack, "msgId:", msg.id);
            if (!ack || ack?.ok === false) {
              // rollback
              messageState.upsetMsg(original);
              toast.error(ack?.reason || "Không thể thu hồi tin nhắn");
            } else {
              toast.success("Đã thu hồi tin nhắn");
            }
          })
          .catch((err) => {
            console.error("recall ack error", err);
            messageState.upsetMsg(original);
            toast.error(
              "Không thể kết nối tới máy chủ. Thu hồi không thành công."
            );
          });
      },
      [chatId, canRecallMessage, emitWithAck, messageState, toast]
    );

    // Toggle pin/gim for a message (only for own messages)
    const handleTogglePin = useCallback(
      (msg: any) => {
        try {
          if (!socket || !socket.connected) return;

          const original = { ...msg };
          const updated = {
            ...msg,
            pinned: !msg.pinned,
            roomId: msg.roomId || chatId,
          };

          // Optimistic
          messageState.upsetMsg(updated);

          emitWithAck(
            "message:pinned",
            {
              roomId: chatId,
              msgId: msg.id,
              pinned: !msg.pinned,
            },
            4000
          )
            .then((ack) => {
              console.debug("emit:message:pin ack:", ack, "msgId:", msg.id);
              if (!ack || ack?.ok === false) {
                messageState.upsetMsg(original);
                toast.error(ack?.reason || "Không thể thay đổi trạng thái gim");
              }
            })
            .catch((err) => {
              console.error("pin ack error", err);
              messageState.upsetMsg(original);
              toast.error(
                "Không thể kết nối tới máy chủ. Thao tác không thành công."
              );
            });
        } catch (err) {
          console.error("❌ Error toggling pin:", err);
        }
      },
      [chatId, emitWithAck, messageState, toast]
    );

    const { setMessageRef } = useReadProgress({
      messages, // ASC time
      container: containerRef.current, // nếu scroll trong div
      stickyBottomPx: 0, // chiều cao sticky dưới (nếu có)
      minVisibleRatio: 0.5, // thấy >=50% coi như đã đọc
      onCommit: (id: string) => {
        roomState.markMessageAsRead(chatId, id, socket);
      }, // debounce 180ms
    });

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
                  const messageWidth = `${
                    Math.floor(Math.random() * 40) + 60
                  }%`;
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
                  hơn • Cuộn lên để tải{" "}
                  <button
                    className="text-blue-500 cursor-pointer"
                    onClick={() => handleLoadMore()}
                  >
                    thêm...
                  </button>
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
                      const isLastInGroup =
                        msgIdx === group.messages.length - 1;
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
                      const messageSpacing = isSameSenderAsPrev
                        ? "mt-1"
                        : "mt-4";

                      // Check if message is new (chưa render)
                      const isNewMessage = !renderedMessageIds.current.has(
                        msg.id
                      );
                      if (!renderedMessageIds.current.has(msg.id)) {
                        renderedMessageIds.current.add(msg.id);
                      }

                      // Chỉ animate messages mới
                      const shouldAnimateThis = shouldAnimate && isNewMessage;

                      // Extract complex nested ternary and IIFE into explicit values/components
                      const MAX_LENGTH = 300;
                      const isExpanded = expandedMessages.has(msg.id);
                      const isLongMessage =
                        !!msg.content && msg.content.length > MAX_LENGTH;
                      const displayContent =
                        !!msg.content && isLongMessage && !isExpanded
                          ? msg.content.slice(0, MAX_LENGTH) + "..."
                          : msg.content;
                      const previewUrl = msg.content
                        ? extractFirstUrl(msg.content)
                        : null;

                      const renderContentBubble = (
                        msg: any,
                        isSameSenderAsPrev: boolean,
                        isSameSenderAsNext: boolean
                      ) => {
                        const MAX_LENGTH = 300;
                        const isExpanded = expandedMessages.has(msg.id);
                        const isLongMessage =
                          !!msg.content && msg.content.length > MAX_LENGTH;
                        const displayContent =
                          !!msg.content && isLongMessage && !isExpanded
                            ? msg.content.slice(0, MAX_LENGTH) + "..."
                            : msg.content;
                        const previewUrl = msg.content
                          ? extractFirstUrl(msg.content)
                          : null;

                        if (msg.hiddenByMe) {
                          return (
                            <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
                              <div
                                className={`
                        relative px-4 py-2.5 rounded-2xl shadow-sm bg-gray-100 text-gray-500 italic text-sm border border-gray-200
                      `}
                              >
                                {msg.isMine
                                  ? "Bạn đã xoá tin nhắn này"
                                  : "Tin nhắn đã bị xoá"}
                              </div>
                            </div>
                          );
                        }
                        // Recalled message
                        if (msg.isDeleted) {
                          return (
                            <div className="relative max-w-xs md:max-w-sm lg:max-w-md">
                              <div
                                className={`
                        relative px-4 py-2.5 rounded-2xl shadow-sm bg-gray-100 text-gray-500 italic text-sm border border-gray-200
                      `}
                              >
                                {msg.isMine
                                  ? "Bạn đã thu hồi tin nhắn này"
                                  : "Tin nhắn đã bị thu hồi"}
                              </div>
                            </div>
                          );
                        }

                        // Regular text content
                        if (msg.content) {
                          return (
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
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {displayContent}
                                </p>

                                {/* Nút xem thêm/thu gọn */}
                                {isLongMessage && (
                                  <button
                                    onClick={() => toggleExpanded(msg.id)}
                                    className={`text-xs mt-1 font-medium hover:underline ${
                                      msg.isMine
                                        ? "text-blue-100"
                                        : "text-blue-600"
                                    }`}
                                  >
                                    {isExpanded ? "Thu gọn" : "Xem thêm"}
                                  </button>
                                )}

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
                              {previewUrl ? (
                                <div className="mt-2">
                                  <LinkPreview
                                    url={previewUrl}
                                    isMine={msg.isMine}
                                  />
                                </div>
                              ) : null}
                            </div>
                          );
                        }

                        return null;
                      };

                      const contentBubble = renderContentBubble(
                        msg,
                        isSameSenderAsPrev,
                        isSameSenderAsNext
                      );

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
                                  ✨ Tin chưa đọc
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
                                  {msg.read_by
                                    .slice(0, 3)
                                    .map((read_by: any) => (
                                      <Tooltip
                                        key={read_by.user.id}
                                        content={
                                          read_by.user.fullname || "User"
                                        }
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
                                    msg.isMine ? "" : "flex-row-reverse"
                                  }`}
                                >
                                  <div
                                    className={`flex gap-2 items-center  ${
                                      msg.isMine ? "" : "flex-row-reverse"
                                    }`}
                                  >
                                    {/* Actions are hidden for deleted/hidden messages */}
                                    {!msg.isDeleted && !msg.hiddenByMe && (
                                      <>
                                        <Dropdown backdrop="blur">
                                          <DropdownTrigger>
                                            <Button
                                              className=" text-gray-400 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                              size="sm"
                                              variant="flat"
                                              isIconOnly
                                            >
                                              <EllipsisVerticalIcon className="h-3 w-3" />
                                            </Button>
                                          </DropdownTrigger>
                                          <DropdownMenu
                                            aria-label="Static Actions"
                                            variant="faded"
                                          >
                                            {/* Pin / Gim */}
                                            {!noAction && (
                                              <DropdownItem
                                                key="gim"
                                                onPress={() =>
                                                  handleTogglePin(msg)
                                                }
                                              >
                                                {msg.pinned ? "Bỏ gim" : "Gim"}
                                              </DropdownItem>
                                            )}

                                            {msg.type === "text" && (
                                              <DropdownItem
                                                key="copy"
                                                onPress={() =>
                                                  handleCopy(msg.content)
                                                }
                                              >
                                                Sao chép
                                              </DropdownItem>
                                            )}
                                            {/* Actions limited to messages created by me */}
                                            {msg.isMine && (
                                              <>
                                                {/* Nếu trong 30 phút → cho thu hồi (recall), ngược lại cho xoá */}
                                                {canRecallMessage(msg) ? (
                                                  <DropdownItem
                                                    key="recall"
                                                    onPress={() =>
                                                      handleRecall(msg)
                                                    }
                                                  >
                                                    Thu hồi
                                                  </DropdownItem>
                                                ) : null}
                                              </>
                                            )}
                                            <DropdownItem
                                              key="delete"
                                              className="text-danger"
                                              color="danger"
                                              onPress={() => handleDelete(msg)}
                                            >
                                              Xoá
                                            </DropdownItem>
                                            {msg.type === "audio" && (
                                              <DropdownItem
                                                key="speed-to-text"
                                                color="secondary"
                                                // onPress={() => handleDelete(msg)}
                                              >
                                                Chuyển âm thanh thành văn bản
                                              </DropdownItem>
                                            )}
                                          </DropdownMenu>
                                        </Dropdown>

                                        <Button
                                          className=" text-gray-400 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                                          size="sm"
                                          variant="flat"
                                          isIconOnly
                                          onPress={() => handleReply(msg)}
                                        >
                                          <ArrowUturnLeftIcon className="h-3 w-3" />
                                        </Button>

                                        <Popover
                                          placement="top"
                                          backdrop="opaque"
                                        >
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
                                          <PopoverContent className="p-2">
                                            <div className="flex flex-col gap-2">
                                              <div className="text-xs font-semibold text-gray-600 px-2">
                                                Thả cảm xúc
                                              </div>
                                              <div className="grid grid-cols-6 gap-1">
                                                {EMOJIS.map((emoji) => (
                                                  <button
                                                    key={emoji}
                                                    onClick={() =>
                                                      handleReact(msg, emoji)
                                                    }
                                                    className="text-2xl hover:scale-125 transition-transform duration-200 p-2 rounded-lg hover:bg-gray-100"
                                                  >
                                                    {emoji}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </>
                                    )}
                                  </div>
                                  <div
                                    className={`flex flex-col ${
                                      msg.isMine ? "items-end" : "items-start"
                                    }`}
                                  >
                                    {/* Reply preview (hidden for deleted/recalled messages) */}
                                    {!msg.isDeleted &&
                                      !msg.hiddenByMe &&
                                      msg.status !== "recalled" &&
                                      msg.reply && (
                                        <ReplyPreview
                                          reply={msg.reply}
                                          onJump={scrollToMessage}
                                        />
                                      )}

                                    {/* Tên người gửi (chỉ hiện cho tin đầu tiên trong nhóm và không phải tin của mình) */}
                                    {!msg.isMine && !isSameSenderAsPrev && (
                                      <span className="text-xs text-gray-500 mb-1 ml-3 font-medium">
                                        {msg.sender.fullname || "User"}
                                      </span>
                                    )}
                                    {/* Attachments (hidden when message is deleted) */}
                                    {!msg.isDeleted &&
                                      msg.attachments &&
                                      !msg.hiddenByMe &&
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
                                    {/* Content bubble (handle deleted / recalled / regular content) */}
                                    {contentBubble}

                                    {/* Reactions display (hidden for deleted/recalled messages) */}
                                    {!msg.isDeleted &&
                                      !msg.hiddenByMe &&
                                      msg.status !== "recalled" &&
                                      msg.reactions &&
                                      msg.reactions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {msg.reactions.map(
                                            (reaction: any, idx: number) => (
                                              <Tooltip
                                                key={`${reaction.emoji}-${idx}`}
                                                content={
                                                  <div className="text-xs">
                                                    {reaction.users
                                                      ?.map(
                                                        (u: any) =>
                                                          u.usr_fullname ||
                                                          "User"
                                                      )
                                                      .join(", ")}
                                                  </div>
                                                }
                                                size="sm"
                                              >
                                                <button
                                                  className={`
                                                      flex items-center gap-1 px-2 py-1 rounded-full
                                                      text-xs font-medium transition-all duration-200
                                                      ${
                                                        reaction.hasReacted
                                                          ? "bg-blue-100 border-2 border-blue-400"
                                                          : "bg-gray-100 border border-gray-300 hover:bg-gray-200"
                                                      }
                                                    `}
                                                >
                                                  <span className="text-sm">
                                                    {reaction.emoji}
                                                  </span>
                                                  <span className="text-gray-600">
                                                    {reaction.count}
                                                  </span>
                                                </button>
                                              </Tooltip>
                                            )
                                          )}
                                        </div>
                                      )}
                                  </div>
                                </div>

                                {/* Timestamp - chỉ hiện ở tin cuối nhóm */}
                                {showAvatar && (
                                  <div
                                    className={`flex items-center gap-1 mt-1 ${
                                      msg.isMine
                                        ? "flex-row-reverse"
                                        : "flex-row"
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
                                        {msg.read_by_count > 0 ? (
                                          <Tooltip
                                            content="Đã xem"
                                            size="sm"
                                            placement="left-start"
                                          >
                                            ✓✓
                                          </Tooltip>
                                        ) : (
                                          <Tooltip
                                            content="Đã gửi"
                                            size="sm"
                                            placement="left-start"
                                          >
                                            ✓
                                          </Tooltip>
                                        )}
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
                                  {msg.read_by
                                    .slice(0, 3)
                                    .map((read_by: any) => (
                                      <Tooltip
                                        key={read_by.user.id}
                                        content={
                                          read_by.isMine
                                            ? "Bạn"
                                            : read_by.user.fullname || "User"
                                        }
                                        size="sm"
                                      >
                                        <Avatar
                                          src={read_by.user.avatar || undefined}
                                          className="w-3 h-3 ring-2 ring-white"
                                          name={
                                            read_by.isMine
                                              ? "Bạn"
                                              : read_by.user.fullname || "User"
                                          }
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

              {/* Badge hiển thị số tin nhắn chưa đọc */}
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
  }
);

// Set displayName cho debugging
ChatMessages.displayName = "ChatMessages";

// ...existing code...
