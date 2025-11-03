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
import { useEffect, useRef, useState } from "react";
import { CreateRoomModal } from "../chat/modals/createRoom.modal";

export const Home = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("chat");
  const [search, setSearch] = useState("");
  const handleTab = (tab: string) => () => {
    router.push(`${pathname}?tab=${tab}`);
  };

  const roomState = useRoomStore((state) => state);
  const [limit, setLimit] = useState(roomState.rooms.length || 20);
  const queryRoom = {
    q: search,
    limit,
    type: roomState.type,
  };
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  useEffect(() => {
    // Load từ IndexedDB vào state (nếu có cache)
    roomState.getRoomsByType("all"); // ← Đọc từ DB vào state

    // Sau đó fetch mới từ API
    roomState.getRooms(); // ← Sync với server
  }, []);
  useEffect(() => {
    roomState.getRooms(queryRoom);
    console.log(roomState.rooms);
  }, [limit, roomState.type, search]);

  //  xử lý cuộn
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          console.log("🎯 Đã chạm đáy div!");
          // gọi API load thêm data ở đây
          setLimit((prev) => prev + 20);
        }
      },
      { threshold: 1 }
    );

    if (bottomRef.current) observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, []);

  function btnNewMsg() {
    return (
      <Tooltip content="Tin nhắn mới" placement="bottom">
        <Button variant="light" size="sm" onPress={() => setOpenModal(true)}>
          <PencilSquareIcon className="w-5 h-5" />
        </Button>
      </Tooltip>
    );
  }
  return (
    <>
      {!isSearchVisible && (
        <div className="flex items-center justify-end p-1 border-b border-gray-200">
          {/* <Image alt="logo" src="/logo.jpg" width={20} /> */}
          {btnNewMsg()}
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
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsSearchVisible(true)}
              endContent={
                isSearchVisible ? (
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    color="primary"
                    onPress={() => {
                      setIsSearchVisible(false);
                      setSearch("");
                    }}
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </Button>
                ) : (
                  <MagnifyingGlassIcon className="w-5 h-5" />
                )
              }
            />
            {isSearchVisible && btnNewMsg()}
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
                <Tab key="all" title="Tin nhắn" />
                <Tab key="group" title="Nhóm" />
                <Tab key="call" title="Cuộc gọi" />
              </Tabs>
            </div>
          )}

          {/* {activeTab === "contact" && (
              <div className="w-8/12 mx-auto mb-3">
                <Tabs
                  aria-label="Chat type"
                  variant="solid"
                  color="primary"
                  fullWidth
                >
                  <Tab key="direct" title="Trực tiếp" />
                  <Tab key="group" title="Nhóm" />
                </Tabs>
              </div>
            )} */}
        </CardBody>
      </Card>
      <div id="list-chat" className="flex-1 overflow-y-auto scroll-smooth">
        {/* Chat List */}
        <div className="divide-y divide-gray-200 ">
          {/* Josephine Water */}
          {roomState.rooms.map((chat, index) => (
            <Card
              key={chat.id}
              className="rounded-none shadow-none cursor-pointer hover:bg-gray-50"
            >
              <CardBody
                className="p-4 flex flex-row items-center justify-between"
                onClick={() => {
                  // Handle chat selection
                  console.log(`Selected chat with ${chat.name}`);
                  // You can use useRouter to navigate if needed

                  router.push(`/chat?chatId=${chat.id}`);
                  setIsSearchVisible(false);
                  setSearch("");
                }}
              >
                <div className="flex items-center space-x-3">
                  <Avatar
                    src={chat.avatar ?? undefined}
                    name={chat.name ?? undefined}
                    size="md"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-800">{chat.name}</h3>
                    {/* <p className="text-sm text-gray-500">{chat.message}</p> */}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">
                    {chat.updatedAt ? formatTimeAgo(chat.updatedAt) : ""}
                  </p>
                  <Badge color="danger" size="sm" content="5">
                    <span />
                  </Badge>
                </div>
              </CardBody>
            </Card>
          ))}
          <div ref={bottomRef}></div>
        </div>
      </div>
      <CreateRoomModal isOpen={openModal} onClose={() => setOpenModal(false)} />
    </>
  );
};
