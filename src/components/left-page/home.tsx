"use client";
import formatTimeAgo from "@/libs/forrmattime";
import useRoomStore from "@/store/useRoomStore";
import {
  MagnifyingGlassCircleIcon,
  MagnifyingGlassIcon,
  XCircleIcon,
} from "@heroicons/react/16/solid";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
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
  Image,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { CreateRoomModal } from "../chat/modals/createRoom.modal";
import { useSocket } from "../providers/SocketProvider";
import useMessageStore from "@/store/useMessageStore";

export const Home = () => {
  const { socket } = useSocket();

  const router = useRouter();
  const pathname = usePathname();

  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);

  const [limit, setLimit] = useState(20); // Fixed initial value
  const [search, setSearch] = useState("");
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [openModal, setOpenModal] = useState(false);

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
    // Load từ IndexedDB vào state (nếu có cache)
    roomState.getRoomsByType("all");
    // Fetch mới từ API
    roomState.getRooms();
  }, []); // Only on mount

  /**
   * useEffect: Lắng nghe socket reconnect và fetch danh sách rooms mới nhất
   * Xảy ra khi: Socket reconnect sau khi mất kết nối
   */
  useEffect(() => {
    if (!socket) return;

    const handleReconnect = () => {
      console.log(
        "🔌 [SOCKET RECONNECT] Socket đã kết nối lại, đang fetch danh sách rooms mới nhất..."
      );

      // Đợi một chút để đảm bảo socket đã hoàn toàn kết nối
      setTimeout(async () => {
        try {
          console.log(
            "📥 [SOCKET RECONNECT] Fetching danh sách rooms mới nhất"
          );

          // Fetch lại danh sách rooms từ server với query hiện tại
          await roomState.getRooms(queryRoom);

          console.log(
            "✅ [SOCKET RECONNECT] Đã tải danh sách rooms thành công"
          );
        } catch (error) {
          console.error(
            "❌ [SOCKET RECONNECT] Lỗi khi tải danh sách rooms:",
            error
          );
        }
      }, 500); // Đợi 500ms để socket ổn định
    };

    // Lắng nghe sự kiện reconnect
    socket.on("connect", handleReconnect);

    // Cleanup
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, queryRoom, roomState]);

  // Debounce search và fetch khi query thay đổi
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      roomState.getRooms(queryRoom);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [queryRoom]);

  //  Optimized infinite scroll
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoadingMore = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isLoadingMore.current) {
          console.log("🎯 Load more rooms...");
          isLoadingMore.current = true;
          setLimit((prev) => prev + 20);
          // Reset flag sau khi load xong
          setTimeout(() => {
            isLoadingMore.current = false;
          }, 500);
        }
      },
      {
        threshold: 0.5, // Trigger khi thấy 50% element
        rootMargin: "100px", // Preload trước 100px
      }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  // Memoize button component
  const btnNewMsg = useMemo(
    () => (
      <Tooltip content="Tin nhắn mới" placement="bottom">
        <Button variant="light" size="sm" onPress={() => setOpenModal(true)}>
          <PencilSquareIcon className="w-5 h-5" />
        </Button>
      </Tooltip>
    ),
    []
  );

  // Optimize chat click handler
  const handleChatClick = useCallback(
    (chat: any) => {
      console.log(`Selected chat with ${chat.name}`);
      roomState.getRoomById(chat.id);
      router.push(`/chat?chatId=${chat.id}`);
      setIsSearchVisible(false);
      setSearch("");
    },
    [roomState, socket]
  );

  // Optimize search handlers
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSearchFocus = useCallback(() => {
    setIsSearchVisible(true);
  }, []);

  const handleSearchClear = useCallback(() => {
    setIsSearchVisible(false);
    setSearch("");
  }, []);

  // Handle tab navigation
  const handleTab = useCallback(
    (tab: string) => () => {
      router.push(`${pathname}?tab=${tab}`);
    },
    [router, pathname]
  );

  return (
    <>
      {!isSearchVisible && (
        <div className="flex items-center justify-end p-1 border-b border-gray-200">
          {/* <Image alt="logo" src="/logo.jpg" width={20} /> */}
          {btnNewMsg}
        </div>
      )}
      {/* Top Bar */}

      {/* Status Section */}
      {!isSearchVisible && (
        <Card className="rounded-none shadow-none border-b border-gray-200">
          <CardBody className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-800">Hoạt động</h2>
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
              <div className="flex flex-col items-center space-y-1 flex-shrink-0">
                <Badge content=" " color="success" placement="bottom-right">
                  <Avatar
                    src="https://avatar.iran.liara.run/public"
                    name="My Status"
                    size="lg"
                    isBordered
                    color="success"
                  />
                </Badge>
                <p className="text-xs text-gray-600 text-center">
                  Trạng thái của tôi
                </p>
              </div>
              {["Jesus", "Mari", "Kristin", "Lea"].map((name, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center space-y-1 flex-shrink-0"
                >
                  <Avatar
                    src={`https://avatar.iran.liara.run/public?text=${name.charAt(
                      0
                    )}`}
                    name={name}
                    size="lg"
                  />
                  <p className="text-xs text-gray-600 text-center">{name}...</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Messages Section */}
      <Card className="rounded-none shadow-none border-b border-gray-200">
        <CardBody className="p-4">
          <div className="flex justify-between items-center mb-3">
            <Input
              placeholder="Tìm kiếm"
              size="sm"
              type="text"
              value={search}
              onChange={handleSearchChange}
              onFocus={handleSearchFocus}
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
                  <MagnifyingGlassIcon className="w-5 h-5" />
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
              >
                <Tab key="all" title="Tất cả" />
                <Tab key="group" title="Nhóm" />
                <Tab key="channel" title="Kênh" />
              </Tabs>
            </div>
          )}
        </CardBody>
      </Card>
      <div
        id="list-chat"
        className="flex-1 overflow-y-auto scroll-smooth w-full shadow-[4px_0_10px_-2px_rgba(0,0,0,0.1)]"
      >
        {/* Chat List */}
        <div className="divide-y divide-gray-200 w-full">
          {roomState.rooms.map((chat) => (
            <Card
              key={chat.id}
              isPressable
              className="w-full rounded-none shadow-none cursor-pointer hover:bg-gray-50 transition-colors"
              onPress={() => handleChatClick(chat)}
            >
              <CardBody className="w-full p-4 flex flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <Avatar
                    src={chat.avatar ?? undefined}
                    name={chat.name ?? undefined}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {chat.name}
                    </h3>
                    <p
                      className={`
    text-sm text-gray-700 truncate font-${chat.is_read ? "normal" : "semibold"}
    block w-full max-w-[220px]
  `}
                      title={chat?.last_message?.content || ""}
                    >
                      {chat?.last_message?.content || ""}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs text-gray-400 whitespace-nowrap">
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
              </CardBody>
            </Card>
          ))}
          <div
            ref={bottomRef}
            className="h-10 flex items-center justify-center"
          >
            {isLoadingMore.current && (
              <div className="text-xs text-gray-400">Đang tải...</div>
            )}
          </div>
        </div>
      </div>
      <CreateRoomModal isOpen={openModal} onClose={() => setOpenModal(false)} />
    </>
  );
};
