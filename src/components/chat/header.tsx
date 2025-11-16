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
import { CallModal } from "./modals/call.modal";
import useRoomStore from "@/store/useRoomStore";

interface ChatHeaderProps {
  // chatName?: string;
  isOnline?: boolean;
  // avatarUrl?: string;
  callback?: () => void;
  noAction?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  // chatName = "Family Ties",
  // avatarUrl = "https://avatar.iran.liara.run/public",
  noAction = false,
  isOnline = true,
  callback = () => {},
}) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");
  const [formModalCall, setFormModalCall] = React.useState({
    isOpen: false,
    isVideo: false,
    isIncoming: false,
    caller: { id: "", name: "", avatar: "" },
  });
  const roomState = useRoomStore((state) => state);
  // const handleOpenDrawer = () => {
  //   setIsDrawerOpen(true);
  //   if (callback) {
  //     callback();
  //   }
  // };

  // const handleCloseDrawer = () => {
  //   setIsDrawerOpen(false);
  //   if (callback) {
  //     callback();
  //   }
  // };

  const handleShowModalCall = (
    isVideo: boolean,
    isIncoming: boolean,
    caller: { id: string; name: string; avatar: string }
  ) => {
    setFormModalCall({
      isOpen: true,
      isVideo,
      isIncoming,
      caller,
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
                onPress={() =>
                  handleShowModalCall(true, false, {
                    id: roomState.room?.roomId || "0",
                    name: roomState.room?.name || "Unknown",
                    avatar:
                      roomState.room?.avatar ||
                      "https://avatar.iran.liara.run/public",
                  })
                }
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
                onPress={() =>
                  handleShowModalCall(false, false, {
                    id: roomState.room?.roomId || "0",
                    name: roomState.room?.name || "Unknown",
                    avatar:
                      roomState.room?.avatar ||
                      "https://avatar.iran.liara.run/public",
                  })
                }
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
      <CallModal
        isOpen={formModalCall.isOpen}
        onClose={() => setFormModalCall((prev) => ({ ...prev, isOpen: false }))}
        isIncoming={formModalCall.isIncoming}
        isVideo={formModalCall.isVideo}
        onAccept={() => {}}
        onDecline={() => {}}
        caller={formModalCall.caller}
      />
    </div>
  );
};

export default ChatHeader;
