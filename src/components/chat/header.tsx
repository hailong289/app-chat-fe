import React from "react";
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  Button,
  Avatar,
  Chip,
  Input,
  useDisclosure,
  Badge,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import {
  PencilIcon,
  MagnifyingGlassIcon,
  VideoCameraIcon,
  PhoneIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ChatDrawer from "./drawer/chat-drawer";
import useRoomStore from "@/store/useRoomStore";
import { EyeDropperIcon } from "@heroicons/react/16/solid";
import { RoomsState } from "@/store/types/room.state";
import { useSocket } from "../providers/SocketProvider";
import useCallStore from "@/store/useCallStore";
import useAuthStore from "@/store/useAuthStore";
import Helpers from "@/libs/helpers";
import { useRouter } from "next/navigation";

interface ChatHeaderProps {
  // chatName?: string;
  isOnline?: boolean;
  // avatarUrl?: string;
  callback?: () => void;
  noAction?: boolean;
  setScrollto?: (msgId: string | null) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  noAction = false,
  isOnline = true,
  callback = () => {},
  setScrollto = () => {},
}) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isOpenPinned,
    onOpen: onOpenPinned,
    onOpenChange: onOpenChangePinned,
  } = useDisclosure();
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [formModalCall, setFormModalCall] = React.useState({
    isOpen: false,
    isVideo: false,
    isIncoming: false,
    caller: { id: "", name: "", avatar: "" },
  });
  const roomState = useRoomStore((state) => state);
  const { socket } = useSocket();
  const { startCall } = useCallStore();
  const { user } = useAuthStore();
  const router = useRouter();

  const handleStartCall = (room: RoomsState, mode: 'audio' | 'video') => {
    const roomData = room.room;
    if (!roomData) return;
    const userCaller = roomData.members.find(
      (m) => m.id == user?.id
    );
    const userCallee = roomData.members.find(
      (m) => m.id != user?.id
    );
    startCall({
      roomId: roomData.roomId || "",
      mode,
      userCaller: {
        id: userCaller?.id || "",
        fullname: userCaller?.name || "",
        avatar: userCaller?.avatar || "",
      },
      userCallee: {
        id: userCallee?.id || "",
        fullname: userCallee?.name || "",
        avatar: userCallee?.avatar || "",
      },
      socket
    });
  };

  return (
    <div className="w-full h-[80px]">
      <Navbar
        isBordered
        className="bg-primary border-b border-cyan-200 h-[70px]"
        maxWidth="full"
      >
        <NavbarContent justify="start" className="flex-grow">
          {!showSearch ? (
            <NavbarItem className="flex items-center gap-3">
              <Avatar
                src={roomState.room?.avatar ?? undefined}
                alt={roomState.room?.name ?? undefined}
                size="sm"
                className="w-10 h-10"
              />
              <div className="flex flex-col">
                <p className="font-semibold text-white text-sm">
                  {roomState.room?.name}
                </p>
                {roomState.room?.type === "private" && (
                  <div className="flex items-center gap-1">
                    <Chip
                      size="sm"
                      variant="dot"
                      color={isOnline ? "success" : "default"}
                      className="p-0 border-none bg-transparent"
                    >
                      <span className="text-xs text-white">
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </Chip>
                  </div>
                )}
              </div>
            </NavbarItem>
          ) : (
            <NavbarItem className="flex-1 w-full">
              <Input
                placeholder="Tìm kiếm tin nhắn..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                startContent={
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                }
                endContent={
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onClick={() => {
                      setShowSearch(false);
                      setSearchValue("");
                    }}
                  >
                    <XMarkIcon className="w-4 h-4 text-gray-400" />
                  </Button>
                }
                variant="faded"
                classNames={{
                  base: "max-w-full",
                  mainWrapper: "h-full",
                  input: "text-small bg-white",
                  inputWrapper:
                    "h-full font-normal text-default-500 bg-white backdrop-blur-sm border border-white/20",
                }}
                autoFocus
              />
            </NavbarItem>
          )}
        </NavbarContent>

        {!showSearch && (
          <NavbarContent justify="end" className="gap-1">
            {/* <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                className="rounded-full hover:bg-cyan-100 text-white"
                size="sm"
              >
                <PencilIcon className="w-5 h-5" />
              </Button>
            </NavbarItem> */}
            {useRoomStore.getState().room?.pinned_messages &&
              (useRoomStore.getState().room?.pinned_messages?.length ?? 0) > 0 && (
                <NavbarItem>
                  <Badge
                    color="danger"
                    content={useRoomStore.getState().room?.pinned_messages?.length || 0}
                    size="sm"
                    placement="top-left"
                  >
                    <Button
                      isIconOnly
                      variant="light"
                      className="rounded-full hover:bg-cyan-100 text-white"
                      size="sm"
                      onPress={onOpenPinned}
                    >
                      <EyeDropperIcon className="w-5 h-5" />
                    </Button>
                  </Badge>
                </NavbarItem>
              )}

            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                className="rounded-full hover:bg-cyan-100 text-white"
                size="sm"
                onPress={() => setShowSearch(!showSearch)}
              >
                <MagnifyingGlassIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>

            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                className="rounded-full hover:bg-cyan-100 text-white"
                size="sm"
                onPress={() => handleStartCall(roomState, 'video')}
              >
                <VideoCameraIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>
            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                className="rounded-full hover:bg-cyan-100 text-white"
                size="sm"
                onPress={() => handleStartCall(roomState, 'audio')}
              >
                <PhoneIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>

            <NavbarItem>
              <Button
                isIconOnly
                variant="light"
                className="rounded-full hover:bg-cyan-100 text-white"
                size="sm"
                onPress={onOpen}
              >
                <EllipsisVerticalIcon className="w-5 h-5" />
              </Button>
            </NavbarItem>
          </NavbarContent>
        )}
      </Navbar>

      <ChatDrawer isOpen={isOpen} onClose={onOpenChange} noAction={noAction} />
      {/* <CallModal
        isOpen={formModalCall.isOpen}
        onClose={() => setFormModalCall((prev) => ({ ...prev, isOpen: false }))}
        isIncoming={formModalCall.isIncoming}
        isVideo={formModalCall.isVideo}
        onAccept={() => {}}
        onDecline={() => {}}
        caller={formModalCall.caller}
      /> */}

      <Modal
        isOpen={isOpenPinned}
        placement="top"
        scrollBehavior="inside"
        onOpenChange={onOpenChangePinned}
      >
        <ModalContent>
          {(onClosePPinned) => (
            <>
              <ModalHeader className="flex flex-col items-center gap-1">
                Danh sách gim tin nhắn
              </ModalHeader>
              <ModalBody>
                {useRoomStore.getState().room?.pinned_messages &&
                (useRoomStore.getState().room?.pinned_messages?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-4">
                    {useRoomStore.getState().room?.pinned_messages?.map?.((msg) => (
                      <Button
                        key={msg.id}
                        variant="bordered"
                        className="justify-start"
                        onPress={() => {
                          onClosePPinned();
                          setScrollto(msg.id);
                        }}
                      >
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {msg.type === "text" && msg.content}
                          {msg.type === "image" && "📷 Ảnh"}
                          {msg.type === "video" && "🎥 Video"}
                          {msg.type === "file" && "📎 File"}
                          {msg.type === "gif" && "🎬 GIF"}
                        </p>
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">
                    Chưa có tin nhắn nào được gim.
                  </p>
                )}
              </ModalBody>
              <ModalFooter></ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default ChatHeader;
