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
import { CallModal } from "./modals/call.modal";
import useRoomStore from "@/store/useRoomStore";
import { EyeDropperIcon } from "@heroicons/react/16/solid";
import useContactStore from "@/store/useContactStore";
import { useTranslation } from "react-i18next";

interface ChatHeaderProps {
  // chatName?: string;
  // isOnline?: boolean;
  // avatarUrl?: string;
  callback?: () => void;
  noAction?: boolean;
  setScrollto?: (msgId: string | null) => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  noAction = false,

  callback = () => {},
  setScrollto = () => {},
}) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const {
    isOpen: isOpenPinned,
    onOpen: onOpenPinned,
    onOpenChange: onOpenChangePinned,
  } = useDisclosure();
  const [showSearch, setShowSearch] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [searchValue, setSearchValue] = React.useState("");
  const [formModalCall, setFormModalCall] = React.useState({
    isOpen: false,
    isVideo: false,
    isIncoming: false,
    caller: { id: "", name: "", avatar: "" },
  });
  const roomState = useRoomStore((state) => state);
  const contactState = useContactStore((state) => state);
  const onlineMembers = React.useMemo(() => {
    return contactState.online.filter((contact) =>
      roomState.room?.members.some((member) => member.id === contact.id)
    );
  }, [contactState.online, roomState.room?.members]);

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
    <div className="w-full h-[80px] dark:bg-slate-900 bg-white shadow-md z-10">
      <Navbar
        isBordered
        className="bg-primary border-b border-cyan-200 h-full"
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
                      color={onlineMembers.length > 0 ? "success" : "default"}
                      className="p-0 border-none bg-transparent"
                    >
                      <span className="text-xs text-white">
                        {onlineMembers.length > 0
                          ? t("chat.header.online")
                          : t("chat.header.offline")}
                      </span>
                    </Chip>
                  </div>
                )}
              </div>
            </NavbarItem>
          ) : (
            <NavbarItem className="flex-1 w-full">
              <Input
                placeholder={t("chat.header.searchPlaceholder")}
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
              (useRoomStore.getState().room?.pinned_messages?.length ?? 0) >
                0 && (
                <NavbarItem>
                  <Badge
                    color="danger"
                    content={
                      useRoomStore.getState().room?.pinned_messages?.length || 0
                    }
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
                {t("chat.header.pinned.title")}
              </ModalHeader>
              <ModalBody>
                {useRoomStore.getState().room?.pinned_messages &&
                (useRoomStore.getState().room?.pinned_messages?.length ?? 0) >
                  0 ? (
                  <div className="flex flex-col gap-4">
                    {useRoomStore
                      .getState()
                      .room?.pinned_messages?.map?.((msg) => (
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
                            {msg.type === "image" &&
                              t("chat.header.pinned.image")}
                            {msg.type === "video" &&
                              t("chat.header.pinned.video")}
                            {msg.type === "file" &&
                              t("chat.header.pinned.file")}
                            {msg.type === "gif" && t("chat.header.pinned.gif")}
                          </p>
                        </Button>
                      ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">
                    {t("chat.header.pinned.empty")}
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
