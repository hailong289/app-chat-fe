"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import formatTimeAgo from "@/libs/forrmattime";
import useRoomStore from "@/store/useRoomStore";
import { MagnifyingGlassIcon, XCircleIcon } from "@heroicons/react/16/solid";
import {
  PencilSquareIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Avatar,
  Badge,
  Tabs,
  Tab,
  Input,
  Tooltip,
} from "@heroui/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreateRoomModal } from "../chat/modals/createRoom.modal";
import { useSocket } from "../providers/SocketProvider";
import useContactStore from "@/store/useContactStore";
import useAuthStore from "@/store/useAuthStore";
import TypingIndicator from "../chat/input/TypingIndicator";
import useCounterStore from "@/store/useCounterStore";

export const Home = () => {
  const { socket } = useSocket();

  const router = useRouter();
  const pathname = usePathname();
  const countState = useCounterStore((state) => state);
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const authState = useAuthStore((state) => state);

  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<string>(searchParams.get("chatId") || "");

  const queryRoom = useMemo(
    () => ({
      q: search,
      limit,
      type: roomState.type,
    }),
    [search, limit, roomState.type]
  );

  // Load initial data once
  useEffect(() => {
    roomState.getRoomsByType("all");
    roomState.getRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch rooms on socket reconnect
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      console.log(
        "🔌 [SOCKET RECONNECT] Socket reconnected, fetching rooms..."
      );

      setTimeout(async () => {
        try {
          await roomState.getRooms(queryRoom);
          console.log("✅ [SOCKET RECONNECT] Fetched rooms successfully");
        } catch (error) {
          console.error("❌ [SOCKET RECONNECT] Error fetching rooms:", error);
        }
      }, 500);
    };

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, queryRoom, roomState]);

  // Debounce search + query changes
  const getRooms = useRoomStore((state) => state.getRooms);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      getRooms(queryRoom);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [queryRoom, getRooms]);

  // Infinite scroll
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoadingMore = useRef(false);

  const roomsLength = roomState.rooms.length;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry.isIntersecting) return;
        if (isLoadingMore.current) return;

        // ✅ Nếu số room hiện tại < limit => backend đã trả ít hơn số yêu cầu -> coi như hết data, không load nữa
        if (roomsLength < limit) {
          return;
        }

        isLoadingMore.current = true;
        setLimit((prev) => prev + 20);

        // cho nó "cooldown" chút để tránh bị bắn liên tục do layout reflow
        setTimeout(() => {
          isLoadingMore.current = false;
        }, 500);
      },
      {
        threshold: 0.5,
        rootMargin: "100px",
      }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [roomsLength, limit]);

  const btnNewMsg = useMemo(
    () => (
      <Tooltip content="Tin nhắn mới" placement="bottom">
        <Button
          variant="light"
          size="sm"
          onPress={() => setOpenModal(true)}
          className="text-primary"
          isIconOnly
        >
          <PencilSquareIcon className="w-5 h-5" />
        </Button>
      </Tooltip>
    ),
    []
  );

  const btnCollapse = useMemo(
    () => (
      <Tooltip
        content={
          countState.collapsedSidebar
            ? "Mở rộng danh sách"
            : "Thu gọn danh sách"
        }
        placement="bottom"
      >
        <Button
          isIconOnly
          variant="light"
          size="sm"
          className="text-foreground"
          onPress={() => countState.togoleSidebar()}
        >
          {countState.collapsedSidebar ? (
            <ChevronDoubleRightIcon className="w-5 h-5" />
          ) : (
            <ChevronDoubleLeftIcon className="w-5 h-5" />
          )}
        </Button>
      </Tooltip>
    ),
    [countState.collapsedSidebar]
  );

  const handleChatClick = useCallback(
    (chat: any) => {
      roomState.getRoomById(chat.id);
      router.push(`/chat?chatId=${chat.id}`);
      setIsSearchVisible(false);
      setSearch("");
      setTab(chat.id);
    },
    [roomState, router]
  );

  const handleClickAction = useCallback(
    (chat: any) => {
      roomState.getRoomById(chat.id);

      if (!roomState.rooms.some((r) => r.id === chat.id)) {
        roomState.createRoom("private", `Chat với ${chat.id}`, [chat.id]);
      }

      router.push(`/chat?chatId=${chat.id}`);
      setIsSearchVisible(false);
      setSearch("");
      setTab(chat.id);
    },
    [roomState, router]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSearchFocus = useCallback(() => {
    if (!countState.collapsedSidebar) {
      setIsSearchVisible(true);
    }
  }, [countState.collapsedSidebar]);

  const handleSearchClear = useCallback(() => {
    setIsSearchVisible(false);
    setSearch("");
  }, []);

  const handleTab = useCallback(
    (tabKey: string) => () => {
      router.push(`${pathname}?tab=${tabKey}`);
    },
    [router, pathname]
  );

  return (
    <>
      {/* Top actions */}
      {!isSearchVisible && (
        <div className="flex items-center justify-end p-1 border-b border-default dark:bg-slate-900">
          {btnNewMsg}
          {btnCollapse}
        </div>
      )}

      {/* Status Section */}
      {!isSearchVisible && !countState.collapsedSidebar && (
        <Card className="rounded-none shadow-none border-b border-default dark:bg-slate-900">
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-foreground">Hoạt động</h2>
              <Button
                variant="light"
                size="sm"
                className="text-primary"
                onClick={handleTab("messages")}
              >
                Xem tất cả
              </Button>
            </div>

            <div className="flex space-x-4 overflow-x-auto p-1">
              {/* My status */}
              <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                <Badge content=" " color="success" placement="bottom-right">
                  <Avatar
                    src={authState.user?.avatar || undefined}
                    name={authState.user?.fullname || "My Status"}
                    size="lg"
                    isBordered
                    color="success"
                  />
                </Badge>
                <p className="text-xs text-default-500 text-center">
                  Trạng thái của tôi
                </p>
              </div>

              {/* Online contacts */}
              {contactState.online
                .filter((contact) => contact.id !== authState.user?.id)
                .map((contact) => (
                  <button
                    key={contact.id}
                    className="flex flex-col items-center space-y-1 flex-shrink-0"
                    onClick={() => handleClickAction(contact)}
                  >
                    <Avatar
                      src={contact.avatar || undefined}
                      name={contact.fullname}
                      size="lg"
                    />
                    <p className="text-xs text-default-500 text-center">
                      {contact.fullname}...
                    </p>
                  </button>
                ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Search + Tabs */}
      {!countState.collapsedSidebar && (
        <Card className="rounded-none shadow-none border-b border-default dark:bg-slate-900">
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-3 gap-2">
              <Input
                placeholder="Tìm kiếm"
                size="sm"
                type="text"
                variant="bordered"
                value={search}
                onChange={handleSearchChange}
                onFocus={handleSearchFocus}
                classNames={{
                  inputWrapper: "bg-content2",
                }}
                endContent={
                  isSearchVisible ? (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      color="primary"
                      onPress={handleSearchClear}
                    >
                      <XCircleIcon className="w-5 h-5" />
                    </Button>
                  ) : (
                    <MagnifyingGlassIcon className="w-5 h-5 text-default-500" />
                  )
                }
              />
              {isSearchVisible && btnNewMsg}
            </div>

            {!isSearchVisible && (
              <div className="mb-3 w-full">
                <Tabs
                  aria-label="Message options"
                  variant="solid"
                  color="primary"
                  fullWidth
                  selectedKey={roomState.type}
                  onSelectionChange={(key) =>
                    roomState.setType(
                      key as "all" | "group" | "private" | "channel"
                    )
                  }
                  className="bg-content2 rounded-xl"
                >
                  <Tab key="all" title="Tất cả" />
                  <Tab key="group" title="Nhóm" />
                  <Tab key="channel" title="Kênh" />
                </Tabs>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Chat list */}
      <div
        id="list-chat"
        className="flex-1 overflow-y-auto scroll-smooth w-full shadow-[4px_0_10px_-2px_rgba(0,0,0,0.15)] bg-background"
      >
        <div className="divide-y divide-default-200 w-full">
          {roomState.rooms.map((chat) => (
            <Card
              key={chat.id}
              isPressable
              className={`w-full rounded-none shadow-none cursor-pointer transition-colors bg-background hover:bg-default-100 ${
                tab === chat.id ? "bg-default-100" : ""
              } dark:bg-slate-900 dark:hover:bg-slate-800 ${
                tab === chat.id ? "dark:bg-slate-800" : ""
              }`}
              onPress={() => handleChatClick(chat)}
            >
              <CardBody
                className={`w-full ${
                  countState.collapsedSidebar
                    ? "p-2 flex items-center justify-center"
                    : "p-4 flex flex-row items-center justify-between gap-3"
                }`}
              >
                <div
                  className={`flex items-center ${
                    countState.collapsedSidebar
                      ? ""
                      : "space-x-3 flex-1 min-w-0"
                  }`}
                >
                  {countState.collapsedSidebar &&
                    (() => {
                      let badgeContent: string | number | undefined;
                      if (chat.unread_count > 0) {
                        badgeContent =
                          chat.unread_count > 99 ? "99+" : chat.unread_count;
                      } else {
                        badgeContent = undefined;
                      }
                      return (
                        <Badge
                          content={badgeContent}
                          color={chat.unread_count > 0 ? "danger" : undefined}
                          placement="top-right"
                        >
                          <Avatar
                            src={chat.avatar ?? undefined}
                            name={chat.name ?? undefined}
                            size="md"
                            className={
                              countState.collapsedSidebar ? "" : "flex-shrink-0"
                            }
                          />
                        </Badge>
                      );
                    })()}

                  {!countState.collapsedSidebar && (
                    <>
                      <Avatar
                        src={chat.avatar ?? undefined}
                        name={chat.name ?? undefined}
                        size="md"
                        className={
                          countState.collapsedSidebar ? "" : "flex-shrink-0"
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {chat.name}
                        </h3>

                        <p
                          className={`text-sm text-default-600 truncate ${
                            chat.is_read ? "" : "font-semibold"
                          }`}
                          title={chat?.last_message?.content || ""}
                        >
                          {chat?.last_message?.isMine ? "Bạn: " : ""}
                          {!chat?.last_message?.isMine &&
                            chat?.last_message?.sender?.name &&
                            `${chat?.last_message?.sender?.name}: `}

                          {chat?.last_message?.content?.slice(0, 30) || ""}
                          {chat?.last_message?.content &&
                            chat?.last_message?.content.length > 30 &&
                            "..."}
                        </p>
                      </div>

                      <TypingIndicator
                        users={roomState.roomTypingUsers[chat.roomId] || []}
                      />
                    </>
                  )}
                </div>

                {!countState.collapsedSidebar && (
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="text-xs text-default-400 whitespace-nowrap">
                      {chat.updatedAt ? formatTimeAgo(chat.updatedAt) : ""}
                    </p>
                    {chat.unread_count > 0 && (
                      <div className="flex justify-end mt-1">
                        <Chip size="sm" color="danger" variant="solid">
                          {chat.unread_count > 99 ? "99+" : chat.unread_count}
                        </Chip>
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}

          <div
            ref={bottomRef}
            className="h-10 flex items-center justify-center"
          >
            {isLoadingMore.current && (
              <div className="text-xs text-default-400">Đang tải...</div>
            )}
          </div>
        </div>
      </div>

      <CreateRoomModal isOpen={openModal} onClose={() => setOpenModal(false)} />
    </>
  );
};
