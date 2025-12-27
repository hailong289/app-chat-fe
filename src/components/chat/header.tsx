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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody,
  Listbox,
  ListboxItem,
  Spinner,
} from "@heroui/react";
import {
  MagnifyingGlassIcon,
  VideoCameraIcon,
  PhoneIcon,
  EllipsisVerticalIcon,
  XMarkIcon,
  ChatBubbleLeftEllipsisIcon,
  PhotoIcon,
  DocumentIcon,
  SparklesIcon,
  MapPinIcon,
  MusicalNoteIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import ChatDrawer from "./drawer/chat-drawer";
import useRoomStore from "@/store/useRoomStore";
import { roomMembers, RoomsState } from "@/store/types/room.state";
import { useSocket } from "../providers/SocketProvider";
import useCallStore from "@/store/useCallStore";
import useAuthStore from "@/store/useAuthStore";
import useContactStore from "@/store/useContactStore";
import { useTranslation } from "react-i18next";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { aiService, SearchResult } from "@/service/ai.service";

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
  const [searchValue, setSearchValue] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const roomState = useRoomStore((state) => state);
  const { socket } = useSocket("/chat");
  const { openCall } = useCallStore();
  const { user } = useAuthStore();
  const contactState = useContactStore((state) => state);
  const onlineMembers = React.useMemo(() => {
    return contactState.online.filter((contact) =>
      roomState.room?.members.some((member) => member.id === contact.id)
    );
  }, [contactState.online, roomState.room?.members]);

  const handleSearch = async (query: string) => {
    setSearchValue(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await aiService.search(query, roomState.room?._id);
      setSearchResults(res.results || []);
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleStartCall = (room: RoomsState, mode: "audio" | "video") => {
    const roomData = room.room;
    if (!roomData) return;
    openCall({
      roomId: roomData.roomId || "",
      mode,
      members: roomData.members.map((m: roomMembers) => ({
        id: m.id,
        fullname: m.name,
        avatar: m.avatar,
        is_caller: true,
      })),
      currentUser: user,
      socket,
    });
  };

  return (
    <div className="w-full h-auto min-h-[80px] dark:bg-slate-900 bg-white shadow-md z-10 flex flex-col">
      <Navbar
        isBordered
        className="bg-primary border-b border-cyan-200 h-[80px]"
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
            <NavbarItem className="flex-1 w-full relative">
              <Input
                placeholder={t("chat.header.searchPlaceholder")}
                value={searchValue}
                onChange={(e) => handleSearch(e.target.value)}
                startContent={
                  <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />
                }
                endContent={
                  isSearching ? (
                    <Spinner size="sm" color="current" />
                  ) : (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onClick={() => {
                        setShowSearch(false);
                        setSearchValue("");
                        setSearchResults([]);
                      }}
                    >
                      <XMarkIcon className="w-4 h-4 text-gray-400" />
                    </Button>
                  )
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
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 shadow-lg rounded-b-lg z-50 max-h-[300px] overflow-y-auto border border-gray-200 dark:border-gray-700">
                  <Listbox aria-label="Search Results">
                    {searchResults.map((result, index) => (
                      <ListboxItem
                        key={result.contextId || index}
                        description={`Score: ${(result.score * 100).toFixed(
                          0
                        )}%`}
                        startContent={
                          <DocumentIcon className="w-5 h-5 text-primary" />
                        }
                        onClick={() => {
                          console.log("Navigate to", result.messageId);
                          setScrollto(result.messageId);
                          // TODO: Implement navigation to message or document
                        }}
                      >
                        {result.text}
                      </ListboxItem>
                    ))}
                  </Listbox>
                </div>
              )}
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
                onPress={() => handleStartCall(roomState, "video")}
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
                onPress={() => handleStartCall(roomState, "audio")}
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

      {roomState.room?.pinned_messages &&
        roomState.room.pinned_messages.length > 0 && (
          <div className="w-full bg-orange-50 dark:bg-orange-900/20 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all group border-b border-orange-100 dark:border-orange-800/50">
            <div
              role="button"
              tabIndex={0}
              className="flex items-center gap-3 min-w-0"
              onClick={() => {
                if (roomState.room?.pinned_messages) {
                  setScrollto(
                    roomState.room.pinned_messages.at(-1)?.id || null
                  );
                }
              }}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === " ") &&
                  roomState.room?.pinned_messages
                ) {
                  setScrollto(
                    roomState.room.pinned_messages.at(-1)?.id || null
                  );
                }
              }}
            >
              <div className="flex-shrink-0 text-orange-500 dark:text-orange-400">
                <MapPinIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase">
                    {t("chat.header.pinned.title")}
                  </p>
                  {/* Badge đếm số lượng tin ghim */}
                  {roomState.room.pinned_messages.length > 1 && (
                    <span className="bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200 text-[10px] px-1.5 rounded-full font-bold">
                      +{roomState.room.pinned_messages.length - 1}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {(() => {
                    const lastMsg = roomState.room.pinned_messages.at(-1);
                    if (!lastMsg) return "";
                    return lastMsg.type === "text"
                      ? lastMsg.content
                      : t(`chat.header.pinned.${lastMsg.type}`);
                  })()}
                </p>
              </div>
            </div>

            {/* Mũi tên chỉ xuống (Visual Cue) */}
            <div
              role="button"
              tabIndex={0}
              className="text-orange-400 dark:text-orange-500 group-hover:translate-y-0.5 transition-transform"
              onClick={onOpenPinned}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onOpenPinned();
                }
              }}
            >
              <ChevronDownIcon className="w-5 h-5" />
            </div>
          </div>
        )}
      <ChatDrawer
        isOpen={isOpen}
        onClose={onOpenChange}
        noAction={noAction}
        setScrollto={setScrollto}
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
              <ModalBody className="px-4 py-2">
                {roomState.room?.pinned_messages &&
                (roomState.room?.pinned_messages?.length ?? 0) > 0 ? (
                  <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
                    {roomState.room?.pinned_messages?.map((msg) => (
                      <Card
                        key={msg.id}
                        isPressable
                        onPress={() => {
                          onClosePPinned();
                          setScrollto(msg.id);
                        }}
                        className="w-full border border-gray-200 dark:border-gray-700 bg-transparent hover:bg-gray-100 dark:hover:bg-slate-800 transition-all shadow-none"
                      >
                        <CardBody className="flex flex-row items-center gap-3 p-3">
                          <div className="flex-shrink-0 p-2 rounded-xl bg-primary/10 text-primary">
                            {msg.type === "text" && (
                              <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
                            )}
                            {msg.type === "image" && (
                              <PhotoIcon className="w-5 h-5" />
                            )}
                            {msg.type === "video" && (
                              <VideoCameraIcon className="w-5 h-5" />
                            )}
                            {msg.type === "file" && (
                              <DocumentIcon className="w-5 h-5" />
                            )}
                            {msg.type === "gif" && (
                              <SparklesIcon className="w-5 h-5" />
                            )}
                            {msg.type === "audio" && (
                              <MusicalNoteIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div className="flex flex-col flex-grow min-w-0 items-start">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate w-full text-left">
                              {msg.type === "text"
                                ? msg.content
                                : t(`chat.header.pinned.${msg.type}`)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate w-full text-left">
                              {t("common.view")}
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <ChatBubbleLeftEllipsisIcon className="w-12 h-12 mb-2 opacity-20" />
                    <p>{t("chat.header.pinned.empty")}</p>
                  </div>
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
