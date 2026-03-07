import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  Tabs,
  Tab,
  Card,
  CardBody,
  Avatar,
  Accordion,
  AccordionItem,
  CardHeader,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import {
  DocumentTextIcon,
  FilmIcon,
  TableCellsIcon,
  DocumentIcon,
  LinkIcon,
  ArrowTopRightOnSquareIcon,
  PencilSquareIcon,
  AcademicCapIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { CallChangeNameModal } from "../modals/changeName.model";
import {
  ArrowRightEndOnRectangleIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
  NoSymbolIcon,
  PencilIcon,
  PhotoIcon,
  ShieldExclamationIcon,
  TrashIcon,
  UserIcon,
  UserPlusIcon,
} from "@heroicons/react/16/solid";
import useRoomStore from "@/store/useRoomStore";
import useAuthStore from "../../../store/useAuthStore";
import { ConfirmLeavingModal } from "../modals/confirm-leaving.model";
import { DelelteMD } from "../modals/confirm-delete-mbr.model";
import { ChangeNickNameModal } from "../modals/changeNickName.model";
import UploadFileButton from "@/components/upload/UploadFileButton";
import UploadService from "@/service/uploadfile.service";
import { AddMemberModal } from "../modals/add-member.model";
import { CreateQuizzModal } from "../modals/create-quizz.modal";
import { useRouter } from "next/navigation";
import Timeline from "@/components/ui/timeline";
import { useTranslation } from "react-i18next";
import useContactStore from "@/store/useContactStore";
import useMessageStore from "@/store/useMessageStore";
import DocumentService, { Document } from "@/service/document.service";
import { FilePreview } from "@/store/types/message.state";

import MessageService from "@/service/message.service";
import MediaViewerModal from "@/components/modals/MediaViewerModal";
import RoomService from "@/service/room.service";
import { useEffect } from "react";
import QuizzList from "./quizz-list";
import { useSocket } from "@/components/providers/SocketProvider";
import { QuizzResponse } from "@/types/quizz.type";

export default function ChatDrawer({
  isOpen,
  onClose,
  noAction,
  setScrollto,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  noAction: boolean;
  setScrollto?: (msgId: string) => void;
}>) {
  const { t } = useTranslation();
  const { BlockUser, UnlockBlockedUser } = useContactStore();
  const [selectedKeys, setSelectedKeys] = useState(new Set(["1"]));
  const [selectedTab, setSelectedTab] = useState<
    "media" | "file" | "link" | "docs"
  >("media");
  const { room: currentRoom } = useRoomStore();
  const messagesRoom = useMessageStore((state) => state.messagesRoom);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const { socket } = useSocket("/chat");

  // Local state for files
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Media Viewer State
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (isOpen && currentRoom?._id) {
      setPage(1);
      setFiles([]);
      setHasMore(true);
      fetchFiles(1);
    }
  }, [isOpen, currentRoom?._id, selectedTab]);

  const fetchFiles = async (currentPage: number) => {
    if (!currentRoom?._id) return;

    setIsLoadingFiles(true);
    try {
      let newFiles: any[] = [];

      if (selectedTab === "media") {
        newFiles = await UploadService.getAttachments({
          roomId: currentRoom._id,
          type: "media",
          page: currentPage,
          limit: 20,
        });
      } else if (selectedTab === "file") {
        newFiles = await UploadService.getAttachments({
          roomId: currentRoom._id,
          type: "file",
          page: currentPage,
          limit: 20,
        });
      } else if (selectedTab === "link") {
        newFiles = await UploadService.getAttachments({
          roomId: currentRoom._id,
          type: "link",
          page: currentPage,
          limit: 20,
        });
      } else if (selectedTab === "docs") {
        // DocumentService might not support pagination yet, assuming it returns all
        if (currentPage === 1) {
          const docs = await DocumentService.getDocuments(currentRoom._id);
          newFiles = (docs as any) || [];
        } else {
          newFiles = [];
        }
      }

      if (newFiles.length < 20) setHasMore(false);

      setFiles((prev) => {
        // Filter duplicates
        const combined = [...prev, ...newFiles];
        const unique = combined.filter(
          (item, index, self) =>
            index === self.findIndex((t) => t._id === item._id)
        );
        return unique;
      });
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (
      scrollHeight - scrollTop <= clientHeight + 50 &&
      !isLoadingFiles &&
      hasMore
    ) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFiles(nextPage);
    }
  };

  const handleChangeRole = async (memberId: string, role: string) => {
    if (!currentRoom?.id) return;
    try {
      await RoomService.changeRole({
        roomId: currentRoom.id,
        memberId,
        role,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const [openChangeNameModal, setOpenChangeNameModal] = useState(false);
  const [openChangeLeavingModal, setOpenChangeLeavingModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberIdToDelete, setMemberIdToDelete] = useState<string | null>(null);
  const [openChangeNickNameModal, setOpenChangeNickNameModal] = useState(false);
  const [openAddMemberModal, setOpenAddMemberModal] = useState(false);
  const [openClearHistoryModal, setOpenClearHistoryModal] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [openCreateQuizzModal, setOpenCreateQuizzModal] = useState(false);
  const [refreshQuizzList, setRefreshQuizzList] = useState(false);
  const roomState = useRoomStore((state) => state);
  const userState = useAuthStore((state) => state);
  const user = userState.user;
  const isAdmin = roomState.room?.members?.some(
    (member) => member.id === user?.id && member.role === "admin"
  );
  const isGuest = roomState.room?.members?.some(
    (member) => member.id === user?.id && member.role === "guest"
  );

  // Refresh quizz list when modal closes (after creating a new quizz)
  useEffect(() => {
    if (!openCreateQuizzModal) {
      setRefreshQuizzList((prev) => !prev);
    }
  }, [openCreateQuizzModal]);

  const role: Record<string, string> = {
    admin: t("chat.drawer.roles.admin"),
    member: t("chat.drawer.roles.member"),
    owner: t("chat.drawer.roles.owner"),
    guest: t("chat.drawer.roles.guest"),
  };
  const router = useRouter();
  const handleChatPrivate = (id: string) => {
    roomState.createRoom("private", `${t("chat.drawer.chatWith")} ${id}`, [id]);
    router.push(`/chat?chatId=${id}`);
  };

  const handleConfirmClearHistory = async (onClose: () => void) => {
    if (!roomState.room?.id) return;
    setIsClearingHistory(true);
    const success = await roomState.clearHistory();
    setIsClearingHistory(false);
    if (success) {
      onClose();
    }
  };
  return (
    <>
      <Drawer
        isOpen={isOpen}
        onOpenChange={onClose}
        backdrop="transparent"
        className=""
      >
        <DrawerContent>
          {(onClose) => (
            <>
              {/* <DrawerHeader className="flex items-center justify-between p-6 relative w-full">
              <div className="flex w-full items-center gap-4">
                <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" />
              </div>
            </DrawerHeader> */}
              <DrawerBody className="p-6 pt-0">
                <Card className="mt-20 flex flex-col items-center justify-center mb-6 shadow-none border border-none">
                  <CardHeader className="pb-0 pt-2 px-4 flex justify-center items-center flex-col gap-1 text-center">
                    <Avatar
                      size="lg"
                      src={roomState.room?.avatar ?? undefined}
                      name={roomState.room?.name ?? undefined}
                    />
                  </CardHeader>
                  <CardBody className="overflow-visible py-2 flex flex-col items-center justify-center text-center">
                    <h3 className="font-semibold text-gray-800 text-lg">
                      {roomState.room?.name}
                    </h3>
                  </CardBody>
                </Card>
                <div className="h-[calc(100vh-200px)] overflow-hidden overflow-y-auto">
                  <Accordion
                    selectedKeys={selectedKeys}
                    onSelectionChange={(keys) =>
                      setSelectedKeys(
                        new Set(
                          typeof keys === "string"
                            ? [keys]
                            : Array.from(keys, String)
                        )
                      )
                    }
                  >
                    {[
                      noAction ? null : (
                        <AccordionItem
                          key="1"
                          aria-label="Accordion 1"
                          title={t("chat.drawer.customize.title")}
                        >
                          <div className="w-full">
                            {roomState.room?.type !== "private" && !isGuest && (
                              <>
                                <Button
                                  className="w-full justify-start"
                                  variant="light"
                                  onPress={() => setOpenChangeNameModal(true)}
                                  startContent={
                                    <PencilIcon className="w-4 h-4 text-gray-400" />
                                  }
                                >
                                  {t("chat.drawer.customize.changeName")}
                                </Button>
                                <UploadFileButton
                                  service={(file, folder) =>
                                    UploadService.uploadSingle(
                                      Array.isArray(file) ? file[0] : file,
                                      folder
                                    )
                                  }
                                  icon={
                                    <PhotoIcon className="w-4 h-4 text-gray-400" />
                                  }
                                  onDone={(urls) =>
                                    roomState.updateAvatar(urls[0])
                                  }
                                  accept="image/*"
                                  folder="avatar"
                                  label={t("chat.drawer.customize.changePhoto")}
                                  className="w-full justify-start"
                                  variant="light"
                                />
                              </>
                            )}
                            {!isGuest && (
                              <Button
                                className="w-full justify-start"
                                variant="light"
                                onPress={() => setOpenChangeNickNameModal(true)}
                                startContent={
                                  <PencilIcon className="w-4 h-4 text-gray-400" />
                                }
                              >
                                {t("chat.drawer.customize.editNickname")}
                              </Button>
                            )}
                          </div>
                        </AccordionItem>
                      ),
                      roomState.room?.type === "group" ||
                      roomState.room?.type === "channel" ? (
                        <AccordionItem
                          key="2"
                          aria-label="Accordion 2"
                          title={t("chat.drawer.members.title")}
                        >
                          {roomState.room?.members?.map((member) => (
                            <div
                              key={member.id + member.role}
                              className="flex p-2 justify-between items-center gap-4 border border-gray-100 rounded-lg mb-2 hover:bg-gray-50"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <Avatar
                                  size="md"
                                  src={member.avatar ?? undefined}
                                  name={member.name ?? undefined}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-800">
                                    {member.name}
                                  </span>
                                  <span className="text-sm">
                                    {member.role ? role[member.role] : ""}
                                  </span>
                                </div>
                              </div>
                              {user?.id != member.id && (
                                <Dropdown>
                                  <DropdownTrigger>
                                    <Button
                                      className=""
                                      variant="light"
                                      startContent={
                                        <EllipsisVerticalIcon className="w-5 h-5 text-gray-400" />
                                      }
                                    ></Button>
                                  </DropdownTrigger>
                                  <DropdownMenu aria-label="Member options">
                                    <DropdownItem key="1">
                                      <Button
                                        className="w-full justify-start"
                                        variant="light"
                                        onPress={() =>
                                          handleChatPrivate(member.id)
                                        }
                                        startContent={
                                          <ChatBubbleLeftIcon className="w-5 h-5 text-gray-400" />
                                        }
                                      >
                                        {t(
                                          "chat.drawer.members.sendPrivateMessage"
                                        )}
                                      </Button>
                                    </DropdownItem>
                                    <DropdownItem key="2">
                                      <Button
                                        className="w-full justify-start"
                                        variant="light"
                                        startContent={
                                          <UserIcon className="w-5 h-5 text-gray-400" />
                                        }
                                      >
                                        {t("chat.drawer.members.viewProfile")}
                                      </Button>
                                    </DropdownItem>
                                    {isAdmin ? (
                                      <>
                                        <DropdownItem key="set-admin">
                                          <Button
                                            className="w-full justify-start"
                                            variant="light"
                                            onPress={() =>
                                              handleChangeRole(
                                                member.id,
                                                "admin"
                                              )
                                            }
                                          >
                                            {t("chat.drawer.roles.admin")}
                                          </Button>
                                        </DropdownItem>
                                        <DropdownItem key="set-member">
                                          <Button
                                            className="w-full justify-start"
                                            variant="light"
                                            onPress={() =>
                                              handleChangeRole(
                                                member.id,
                                                "member"
                                              )
                                            }
                                          >
                                            {t("chat.drawer.roles.member")}
                                          </Button>
                                        </DropdownItem>
                                        <DropdownItem key="set-guest">
                                          <Button
                                            className="w-full justify-start"
                                            variant="light"
                                            onPress={() =>
                                              handleChangeRole(
                                                member.id,
                                                "guest"
                                              )
                                            }
                                          >
                                            {t("chat.drawer.roles.guest")}
                                          </Button>
                                        </DropdownItem>
                                        <DropdownItem key="3">
                                          <Button
                                            className="w-full justify-start text-red-500"
                                            variant="light"
                                            startContent={
                                              <TrashIcon className="w-5 h-5 text-red-400" />
                                            }
                                            onPress={() => {
                                              setIsDeleteModalOpen(true);
                                              setMemberIdToDelete(member.id);
                                            }}
                                          >
                                            {t(
                                              "chat.drawer.members.removeFromGroup"
                                            )}
                                          </Button>
                                        </DropdownItem>
                                      </>
                                    ) : null}
                                  </DropdownMenu>
                                </Dropdown>
                              )}
                            </div>
                          ))}
                          {!noAction && !isGuest && (
                            <Button
                              className="w-full justify-start"
                              variant="light"
                              onPress={() => setOpenAddMemberModal(true)}
                              startContent={
                                <UserPlusIcon className="w-4 h-4 text-gray-400" />
                              }
                            >
                              {t("chat.drawer.members.addMember")}
                            </Button>
                          )}
                        </AccordionItem>
                      ) : null,
                      <AccordionItem
                        key="3"
                        aria-label="Accordion 3"
                        title={t("chat.drawer.media.title")}
                      >
                        <div className="mb-6">
                          <Tabs
                            selectedKey={selectedTab}
                            onSelectionChange={(key) => {
                              setSelectedTab(
                                key as "media" | "file" | "link" | "docs"
                              );
                              setFiles([]);
                              setPage(1);
                              setHasMore(true);
                            }}
                            color="primary"
                            variant="solid"
                            fullWidth
                            classNames={{
                              tabList:
                                "gap-0 w-full relative rounded-lg bg-gray-100 p-1",
                              cursor: "w-full bg-primary !rounded-md",
                              tab: "w-full px-4 h-10 !bg-transparent data-[selected=true]:!bg-primary !rounded-md",
                              tabContent:
                                "group-data-[selected=true]:!text-white !font-medium !opacity-100",
                            }}
                          >
                            <Tab
                              key="media"
                              title={t("chat.drawer.media.tabs.media")}
                            />
                            <Tab
                              key="file"
                              title={t("chat.drawer.media.tabs.file")}
                            />
                            <Tab
                              key="link"
                              title={t("chat.drawer.media.tabs.link")}
                            />
                            <Tab
                              key="docs"
                              title={t("chat.drawer.media.tabs.docs")}
                            />
                          </Tabs>
                        </div>

                        <div
                          className={`max-h-[400px] overflow-y-auto ${
                            selectedTab === "media"
                              ? "grid grid-cols-3 gap-2 p-1"
                              : "space-y-4"
                          }`}
                          onScroll={handleScroll}
                        >
                          {files.map((item, index) => {
                            const isMedia = selectedTab === "media";
                            const isFile = selectedTab === "file";
                            const isLink = selectedTab === "link";
                            const isDoc = selectedTab === "docs";

                            if (isMedia) {
                              return (
                                <Card
                                  key={item._id || index}
                                  className="aspect-square shadow-none border border-gray-200"
                                  isPressable={false}
                                  onClick={() => {
                                    setPreviewIndex(index);
                                    setIsPreviewOpen(true);
                                  }}
                                >
                                  <CardBody className="p-0 overflow-hidden relative group">
                                    {item.mimeType?.startsWith("image") ||
                                    item.kind === "image" ||
                                    item.kind === "photo" ? (
                                      <img
                                        src={item.url}
                                        className="w-full h-full object-cover"
                                        alt={item.name}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                        <FilmIcon className="w-8 h-8 text-gray-400" />
                                      </div>
                                    )}
                                    <div
                                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        className="text-white"
                                        onPress={() => {
                                          if (item.messageId) {
                                            setScrollto?.(item.messageId);
                                          }
                                        }}
                                      >
                                        <ChatBubbleLeftIcon className="w-5 h-5" />
                                      </Button>
                                    </div>
                                  </CardBody>
                                </Card>
                              );
                            }

                            let icon;
                            let name;
                            let date;
                            let actionIcon = (
                              <ArrowDownTrayIcon className="w-5 h-5" />
                            );
                            let action: () => void = () => {
                              window.open(item.url, "_blank");
                            };

                            if (isFile) {
                              icon = (
                                <DocumentIcon className="w-6 h-6 text-gray-500" />
                              );
                              name =
                                item.name ||
                                t("chat.drawer.media.fallback.file");
                              date = item.createdAt;
                            } else if (isLink) {
                              icon = (
                                <LinkIcon className="w-6 h-6 text-gray-500" />
                              );
                              name = item.name || item.url;
                              date = item.createdAt;
                              actionIcon = (
                                <ArrowTopRightOnSquareIcon className="w-5 h-5" />
                              );
                              action = () => window.open(item.url, "_blank");
                            } else if (isDoc) {
                              icon = (
                                <DocumentIcon className="w-6 h-6 text-blue-500" />
                              );
                              name =
                                item.title ||
                                t("chat.drawer.media.fallback.document");
                              date = item.createdAt;
                              actionIcon = (
                                <PencilSquareIcon className="w-5 h-5" />
                              );
                              action = () => {
                                router.push(`/docs/${item._id}`);
                              };
                            }

                            return (
                              <Card
                                key={item._id || index}
                                className="shadow-none border border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                                isPressable={false}
                                onClick={() => {
                                  if (item.messageId) {
                                    setScrollto?.(item.messageId);
                                  }
                                }}
                              >
                                <CardBody className="flex flex-row items-center justify-between p-4">
                                  <div className="flex items-center gap-4 overflow-hidden flex-1 min-w-0">
                                    <div className="w-12 h-12 min-w-[3rem] rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                      {icon}
                                    </div>
                                    <div className="flex flex-col overflow-hidden flex-1 min-w-0">
                                      <h3 className="font-semibold text-gray-800 truncate pr-2">
                                        {name}
                                      </h3>
                                      <p className="text-sm text-gray-500">
                                        {date
                                          ? new Date(date).toLocaleDateString()
                                          : ""}
                                      </p>
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center gap-2 flex-shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Button
                                      isIconOnly
                                      variant="light"
                                      size="sm"
                                      className="text-gray-400 hover:text-gray-600"
                                      onPress={action}
                                    >
                                      {actionIcon}
                                    </Button>
                                  </div>
                                </CardBody>
                              </Card>
                            );
                          })}
                          {isLoadingFiles && (
                            <div className="col-span-3 flex justify-center py-4">
                              <Spinner />
                            </div>
                          )}
                          {!isLoadingFiles && files.length === 0 && (
                            <p className="col-span-3 text-center text-gray-500 py-4">
                              {t("chat.drawer.media.noFiles")}
                            </p>
                          )}
                        </div>
                      </AccordionItem>,
                      <AccordionItem
                        key="4"
                        aria-label="Accordion 4"
                        title={t("chat.drawer.privacy.title")}
                      >
                        <Button
                          className="w-full justify-start"
                          variant="light"
                          startContent={
                            <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
                          }
                        >
                          <div className="flex flex-col items-start justify-start">
                            <h2 className="font-bold">
                              {t("chat.drawer.privacy.report")}
                            </h2>
                            <span className="text-gray-400">
                              {t("chat.drawer.privacy.reportDesc")}
                            </span>
                          </div>
                        </Button>
                        {roomState.room?.type !== "private" && (
                          <>
                            <Button
                              className="w-full justify-start"
                              variant="light"
                              startContent={
                                <ArrowRightEndOnRectangleIcon className="w-5 h-5 text-gray-400" />
                              }
                              onPress={() => setOpenChangeLeavingModal(true)}
                            >
                              {t("chat.drawer.privacy.leaveGroup")}
                            </Button>
                            <ConfirmLeavingModal
                              isOpen={openChangeLeavingModal}
                              onClose={() => setOpenChangeLeavingModal(false)}
                            />
                          </>
                        )}

                        {roomState.room?.type === "private" && (
                          <Button
                            className="w-full justify-start"
                            variant="light"
                            startContent={
                              <NoSymbolIcon className="w-5 h-5 text-gray-400" />
                            }
                            onPress={async () => {
                              const otherMember = roomState.room?.members?.find(
                                (m) => m.id !== user?.id
                              );
                              if (otherMember && roomState.room?.id) {
                                if (roomState.room?.blockByMine) {
                                  await UnlockBlockedUser(otherMember.id);
                                  roomState.updateBlockStatus(
                                    roomState.room.id,
                                    false,
                                    false
                                  );
                                } else {
                                  await BlockUser(otherMember.id);
                                  roomState.updateBlockStatus(
                                    roomState.room.id,
                                    true,
                                    true
                                  );
                                }
                              }
                            }}
                          >
                            {roomState.room?.blockByMine
                              ? t("chat.drawer.privacy.unblock")
                              : t("chat.drawer.privacy.block")}
                          </Button>
                        )}
                        <Button
                          className="w-full justify-start"
                          variant="light"
                          startContent={
                            <TrashIcon className="w-5 h-5 text-gray-400" />
                          }
                          onPress={() => setOpenClearHistoryModal(true)}
                        >
                          {t("chat.drawer.privacy.clearHistory")}
                        </Button>
                      </AccordionItem>,
                      <AccordionItem
                        key="5"
                        aria-label="Accordion 5"
                        title={t("chat.drawer.history.title")}
                      >
                        <Timeline
                          events={roomState.room?.roomEvents?.map((event) => ({
                            ...event,
                            status: ([
                              "danger",
                              "default",
                              "primary",
                              "success",
                              "warning",
                            ].includes(event.status)
                              ? event.status
                              : "default") as
                              | "danger"
                              | "default"
                              | "primary"
                              | "success"
                              | "warning",
                          }))}
                        />
                      </AccordionItem>,
                      <AccordionItem
                        key="6"
                        aria-label="Accordion 6"
                        title="Quizz"
                      >
                        <div className="space-y-4">
                          <Button
                            className="w-full justify-start"
                            color="primary"
                            variant="solid"
                            startContent={
                              <PlusIcon className="w-4 h-4 text-white" />
                            }
                            onPress={() => {
                              setOpenCreateQuizzModal(true);
                            }}
                          >
                            Tạo quizz
                          </Button>
                          <QuizzList
                            roomId={roomState.room?._id}
                            refreshTrigger={refreshQuizzList}
                            user={user}
                            onSendQuiz={(quiz: QuizzResponse) => {
                              if (!roomState.room?._id || !user) return;

                              sendMessage({
                                roomId: roomState.room._id,
                                content: quiz.quiz_title,
                                attachments: [],
                                type: "quiz",
                                socket,
                                userId: user._id || user.id,
                                userFullname: user.fullname,
                                userAvatar: user.avatar,
                                quiz,
                              });

                              onClose();
                            }}
                          />
                        </div>
                      </AccordionItem>,
                    ].filter(Boolean)}
                  </Accordion>
                </div>
              </DrawerBody>
            </>
          )}
        </DrawerContent>
      </Drawer>
      <DelelteMD
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        memberId={memberIdToDelete ?? ""}
      />
      <CallChangeNameModal
        isOpen={openChangeNameModal}
        onClose={() => setOpenChangeNameModal(false)}
      />

      <ChangeNickNameModal
        isOpen={openChangeNickNameModal}
        onClose={() => setOpenChangeNickNameModal(false)}
      />
      <AddMemberModal
        isOpen={openAddMemberModal}
        onClose={() => setOpenAddMemberModal(false)}
      />
      <Modal
        isOpen={openClearHistoryModal}
        onOpenChange={setOpenClearHistoryModal}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col items-center gap-1">
                {t("chat.modal.clearHistory.title")}
              </ModalHeader>
              <ModalBody>
                <span className="text-sm text-center">
                  {t("chat.modal.clearHistory.description")}
                </span>
              </ModalBody>
              <ModalFooter className="flex justify-center gap-5">
                <Button variant="light" onPress={onClose}>
                  {t("chat.modal.clearHistory.cancel")}
                </Button>
                <Button
                  color="danger"
                  isLoading={isClearingHistory}
                  onPress={() => handleConfirmClearHistory(onClose)}
                >
                  {t("chat.modal.clearHistory.confirm")}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <MediaViewerModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        files={files}
        currentIndex={previewIndex}
        setCurrentIndex={setPreviewIndex}
      />  
      <CreateQuizzModal
        isOpen={openCreateQuizzModal}
        onClose={() => setOpenCreateQuizzModal(false)}
        roomId={roomState.room?._id}
        userId={user?._id}
      />
    </>
  );
}
