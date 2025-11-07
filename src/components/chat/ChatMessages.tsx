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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@heroui/react";
import { useEffect, useRef, useState, useMemo } from "react";
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
import EmojiBar from "./EmojiBar";

export const ChatMessages = ({ chatId }: { chatId: string }) => {
  //
  const { socket } = useSocket();
  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);
  const messages = messageState.messagesRoom[chatId]?.messages || [];
  const lastMsgId = roomState.room?.last_read_id || "null";
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set()
  ); // Track expanded messages
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null); // Track hovered message for actions
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

  // Pagination state for virtual scrolling
  const MESSAGES_PER_GROUP = 20; // 20 tin nhắn mỗi lần load
  const [displayedMessagesCount, setDisplayedMessagesCount] =
    useState(MESSAGES_PER_GROUP);
  const [isLoadingFromAPI, setIsLoadingFromAPI] = useState(false); // Track API loading
  const [hasMoreOnServer, setHasMoreOnServer] = useState(true); // Track if server has more messages
  const hasTriedLoadingFromServer = useRef(false); // Track nếu đã thử load từ server
  //

  useEffect(() => {
    const isSwitchingChat = prevChatIdRef.current !== chatId;

    if (isSwitchingChat) {
      // Disable animations khi chuyển chat
      setShouldAnimate(false);
      prevChatIdRef.current = chatId;
      renderedMessageIds.current.clear(); // Clear tracked messages
      setDisplayedMessagesCount(MESSAGES_PER_GROUP); // Reset về 20 messages khi chuyển chat
      setHasMoreOnServer(true); // Reset server flag when switching chats
      hasTriedLoadingFromServer.current = false; // Reset tried flag
      setExpandedMessages(new Set()); // Reset expanded messages when switching chats
      setReplyingTo(null); // Reset reply target

      // Enable lại animations sau khi render xong (cho messages mới)
      const timer = setTimeout(() => setShouldAnimate(true), 150);

      setIsBottomVisible(false);
      messageState.getMessageByRoomId(chatId);

      // Scroll sau khi data load xong
      requestAnimationFrame(() => {
        scrollToMessage(lastMsgId);
      });

      return () => clearTimeout(timer);
    } else {
      // Không chuyển chat, enable animations cho messages mới
      setShouldAnimate(true);
    }
    // kiểm tra xem có tin nhắn mới nào ko nếu có mới thì gọi api
    if (roomState.room?.last_message.id != messages.at(-1)?.id) {
      messageState.fetchNewMessages(chatId, messages.at(-1)?.id);
    }
  }, [chatId]);

  // // Group messages by date for timeline display
  // const messageGroups = useMemo(() => {
  //   return groupMessagesByDate(messages, lastMsgId);
  // }, [messages, lastMsgId]);

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

  console.log("🚀 ~ ChatMessages ~ Total messages:", messages.length);
  console.log(
    "🚀 ~ Displayed:",
    displayedMessagesCount,
    "| Has more local:",
    hasMoreLocalMessages
  );

  // Optimized scroll detection với throttle
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;

    const checkScrollPosition = () => {
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

      // Load older messages khi scroll đến top (debounced)
      // Tách logic này ra ngoài để luôn check khi scroll
      if (isAtTop && !isLoadingOlder) {
        // Kiểm tra có scroll không (tránh trigger khi content ít)
        const hasScroll = scrollHeight > clientHeight + 10;

        if (hasScroll) {
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
          }

          loadingTimeoutRef.current = setTimeout(() => {
            // Nếu còn messages trong local
            if (hasMoreLocalMessages) {
              console.log("📥 Load more messages from local...");
              console.log(
                "Current displayed:",
                displayedMessagesCount,
                "Total:",
                messages.length
              );
              setIsLoadingOlder(true);

              // Lưu scroll position trước khi load
              const container = containerRef.current;
              const scrollHeightBefore = container?.scrollHeight || 0;

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
              }, 300);
            }
            // Nếu đã hết local, gọi API
            else if (
              hasLoadedAllLocal &&
              !isLoadingFromAPI &&
              hasMoreOnServer
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
                  if (
                    !result ||
                    (Array.isArray(result) && result.length === 0)
                  ) {
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
      }

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkScrollPosition();
        });
        ticking = true;
      }
    };

    // Initial check
    checkScrollPosition();

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [
    isBottomVisible,
    isTopVisible,
    isLoadingOlder,
    hasMoreLocalMessages,
    hasLoadedAllLocal,
    isLoadingFromAPI,
    messages.length,
    displayedMessagesCount,
    chatId,
  ]);

  /** 🎯 Khi có tin nhắn mới → cuộn xuống nếu đang ở gần đáy */
  useEffect(() => {
    const hasNewMessages = messages.length > prevMessageCountRef.current;

    if (hasNewMessages && isBottomVisible) {
      // Delay nhẹ để đợi render xong
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      });
    }

    prevMessageCountRef.current = messages.length;
  }, [messages.length, isBottomVisible]);

  /** 🎯 Điều hướng cuộn: scrollToTop, scrollToBottom, scrollToId */
  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  const scrollToMessage = (id: string) => {
    const el = document.querySelector(`[data-mid="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Helper functions for message actions
  const canRecallMessage = (msg: any) => {
    if (!msg.isMine) return false;
    const sentAt = new Date(msg.createdAt).getTime();
    const now = Date.now();
    const diffMs = now - sentAt;
    const diffMins = diffMs / (1000 * 60);
    return diffMins < 30; // Có thể thu hồi trong 30 phút
  };

  const handleReply = (msg: any) => {
    setReplyingTo(msg);
    // TODO: Scroll to input and focus
  };

  const handleReact = (msg: any) => {
    // TODO: Open emoji picker for reactions
    console.log("React to message:", msg.id);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    // TODO: Show toast notification
    console.log("Copied!");
  };

  const handleDelete = (msg: any) => {
    // TODO: Show confirmation and delete
    messageState.deleteMessage(chatId, msg.id);
    console.log("Deleted message:", msg.id);
  };

  const handleRecall = (msg: any) => {
    if (!canRecallMessage(msg)) {
      console.log("Cannot recall message after 30 minutes");
      return;
    }
    // TODO: Show confirmation and recall
    messageState.recallMessage(chatId, msg.id);
    console.log("Recalled message:", msg.id);
  };

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
    <ScrollShadow
      ref={containerRef}
      className="p-4 overflow-y-auto w-full max-h-[calc(100vh-180px)]"
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

      {/* Info hiển thị trạng thái */}
      {hasMoreLocalMessages && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-2 mb-2"
        >
          <div className="text-xs text-gray-400">
            📜 Còn {messages.length - displayedMessagesCount} tin nhắn cũ hơn •
            Cuộn lên để tải thêm
          </div>
        </motion.div>
      )}

      {/* Timeline grouping - chỉ render visible messages */}
      {visibleGroups.length === 0 && (
        <div className="text-center text-gray-500 mt-10">
          Chưa có tin nhắn nào. Bắt đầu trò chuyện thôi!
        </div>
      )}

      {visibleGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="space-y-4">
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
              const prevMsg = msgIdx > 0 ? group.messages[msgIdx - 1] : null;
              const nextMsg =
                msgIdx < group.messages.length - 1
                  ? group.messages[msgIdx + 1]
                  : null;

              // Kiểm tra có phải tin liên tiếp từ cùng người không
              const isSameSenderAsPrev = prevMsg?.sender._id === msg.sender._id;
              const isSameSenderAsNext = nextMsg?.sender._id === msg.sender._id;

              // Quyết định có hiện avatar không
              const showAvatar = !isSameSenderAsNext || isLastInGroup;

              // Quyết định margin
              const messageSpacing = isSameSenderAsPrev ? "mt-1" : "mt-4";

              // Check if message is new (chưa render)
              const isNewMessage = !renderedMessageIds.current.has(msg.id);
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
                    shouldAnimateThis ? { opacity: 0, scale: 0.95 } : undefined
                  }
                  transition={{
                    duration: shouldAnimateThis ? 0.3 : 0,
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
                          shouldAnimate ? { opacity: 0, scale: 0.8 } : false
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
                    className={`flex w-full items-end gap-2 group ${
                      msg.isMine ? "justify-end" : "justify-start"
                    }`}
                    data-mid={msg.id}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onFocus={() => setHoveredMessageId(msg.id)}
                    onBlur={() => setHoveredMessageId(null)}
                  >
                    {/* Read avatars cho tin của mình (bên trái bubble) */}
                    {isLastInGroup && msg.isMine && msg.read_by_count > 0 && (
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

                        {/* Tên người gửi (chỉ hiện cho tin đầu tiên trong nhóm và không phải tin của mình) */}
                        {!msg.isMine && !isSameSenderAsPrev && (
                          <span className="text-xs text-gray-500 mb-1 ml-3 font-medium">
                            {msg.sender.fullname || "User"}
                          </span>
                        )}

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-2">
                            <CompactFileGallery
                              files={msg.attachments}
                              maxDisplay={2}
                              className="w-full"
                            />
                          </div>
                        )}
                        <div className="flex items-center ">
                          {hoveredMessageId === msg.id && msg.isMine && (
                            <div
                              className={`flex gap-1 mb-1 ${
                                msg.isMine ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              {/* <Popover color="secondary" placement="top">
                                <PopoverTrigger>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-6 w-6 text-gray-500"
                                  >
                                    <FaceSmileIcon className="w-4 h-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent>đfsfsf</PopoverContent>
                              </Popover> */}
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="h-6 w-6 text-gray-500"
                                onClick={() => handleReply(msg)}
                              >
                                <ArrowUturnLeftIcon className="w-4 h-4" />
                              </Button>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-6 w-6 text-gray-500"
                                  >
                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu>
                                  {/* Reply action */}

                                  {/* React action */}
                                  <DropdownItem
                                    key="gim"
                                    startContent={
                                      <EyeDropperIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleReact(msg)}
                                  >
                                    Ghim
                                  </DropdownItem>

                                  {/* Copy action */}
                                  <DropdownItem
                                    key="copy"
                                    startContent={
                                      <DocumentDuplicateIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleCopy(msg.content)}
                                  >
                                    Sao chép
                                  </DropdownItem>

                                  {/* Divider */}
                                  {msg.isMine && (
                                    <DropdownItem
                                      key="divider"
                                      isReadOnly
                                      className="hidden"
                                    />
                                  )}

                                  {/* Delete action - only for own messages */}
                                  <DropdownItem
                                    key="delete"
                                    className="text-danger"
                                    color="danger"
                                    startContent={
                                      <TrashIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleDelete(msg)}
                                  >
                                    Xoá
                                  </DropdownItem>
                                  {/* Recall action - only for own messages within 30 mins */}
                                  {msg.isMine && canRecallMessage(msg) && (
                                    <DropdownItem
                                      key="recall"
                                      className="text-warning"
                                      color="warning"
                                      startContent={
                                        <XMarkIcon className="w-4 h-4" />
                                      }
                                      onClick={() => handleRecall(msg)}
                                    >
                                      Thu hồi
                                    </DropdownItem>
                                  )}
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          )}
                          {/* Content bubble */}
                          {msg.content && (
                            <>
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
                            msg.status === "pending" ||
                            msg.status === "uploading"
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
                                  const isExpanded = expandedMessages.has(
                                    msg.id
                                  );
                                  const isLongMessage =
                                    msg.content.length > MAX_LENGTH;
                                  const displayContent =
                                    isLongMessage && !isExpanded
                                      ? msg.content.slice(0, MAX_LENGTH) + "..."
                                      : msg.content;

                                  return (
                                    <>
                                      <p className="text-sm max-w-[200px] leading-relaxed whitespace-pre-wrap break-words max-w-[50%]">
                                        {displayContent}
                                      </p>

                                      {/* Nút xem thêm/thu gọn */}
                                      {isLongMessage && (
                                        <button
                                          onClick={() => {
                                            setExpandedMessages((prev) => {
                                              const newSet = new Set(prev);
                                              if (isExpanded) {
                                                newSet.delete(msg.id);
                                              } else {
                                                newSet.add(msg.id);
                                              }
                                              return newSet;
                                            });
                                          }}
                                          className={`text-xs mt-1 font-medium hover:underline ${
                                            msg.isMine
                                              ? "text-blue-100"
                                              : "text-blue-600"
                                          }`}
                                        >
                                          {isExpanded ? "Thu gọn" : "Xem thêm"}
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
                                const url = extractFirstUrl(msg.content);
                                return url ? (
                                  <LinkPreview url={url} isMine={msg.isMine} />
                                ) : null;
                              })()}
                            </>
                          )}
                          {hoveredMessageId === msg.id && !msg.isMine && (
                            <div
                              className={`flex gap-1 mb-1 ${
                                msg.isMine ? "flex-row-reverse" : "flex-row"
                              }`}
                            >
                              {" "}
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="h-6 w-6 text-gray-500"
                              >
                                <FaceSmileIcon className="w-4 h-4" />
                              </Button>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="h-6 w-6 text-gray-500"
                                onClick={() => handleReply(msg)}
                              >
                                <ArrowUturnLeftIcon className="w-4 h-4" />
                              </Button>
                              <Dropdown>
                                <DropdownTrigger>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-6 w-6 text-gray-500"
                                  >
                                    <EllipsisVerticalIcon className="w-4 h-4" />
                                  </Button>
                                </DropdownTrigger>
                                <DropdownMenu>
                                  {/* Reply action */}

                                  {/* React action */}
                                  <DropdownItem
                                    key="gim"
                                    startContent={
                                      <EyeDropperIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleReact(msg)}
                                  >
                                    Ghim
                                  </DropdownItem>

                                  {/* Copy action */}
                                  <DropdownItem
                                    key="copy"
                                    startContent={
                                      <DocumentDuplicateIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleCopy(msg.content)}
                                  >
                                    Sao chép
                                  </DropdownItem>

                                  {/* Divider */}
                                  {msg.isMine && (
                                    <DropdownItem
                                      key="divider"
                                      isReadOnly
                                      className="hidden"
                                    />
                                  )}

                                  {/* Delete action - only for own messages */}
                                  <DropdownItem
                                    key="delete"
                                    className="text-danger"
                                    color="danger"
                                    startContent={
                                      <TrashIcon className="w-4 h-4" />
                                    }
                                    onClick={() => handleDelete(msg)}
                                  >
                                    Xoá
                                  </DropdownItem>
                                  {/* Recall action - only for own messages within 30 mins */}
                                  {msg.isMine && canRecallMessage(msg) && (
                                    <DropdownItem
                                      key="recall"
                                      className="text-warning"
                                      color="warning"
                                      startContent={
                                        <XMarkIcon className="w-4 h-4" />
                                      }
                                      onClick={() => handleRecall(msg)}
                                    >
                                      Thu hồi
                                    </DropdownItem>
                                  )}
                                </DropdownMenu>
                              </Dropdown>
                            </div>
                          )}
                          {/* Read avatars cho tin người khác (bên phải bubble) */}
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
                  </fieldset>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ))}

      {/* Bottom marker với height để dễ detect */}
      <div ref={bottomRef} className="h-1 w-full" />

      {/* Scroll to bottom button with animation */}
      <AnimatePresence>
        {!isBottomVisible && containerRef.current && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="sticky bottom-10 float-right"
          >
            <Button
              onPress={scrollToBottom}
              color="secondary"
              className="shadow-lg"
            >
              <ChevronDoubleDownIcon className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </ScrollShadow>
  );
};

// ...existing code...
