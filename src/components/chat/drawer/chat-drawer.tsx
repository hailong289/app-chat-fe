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
} from "@heroui/react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import {
  DocumentTextIcon,
  FilmIcon,
  TableCellsIcon,
  DocumentIcon,
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
import { useRouter } from "next/navigation";
import Timeline from "@/components/ui/timeline";

export default function ChatDrawer({
  isOpen,
  onClose,
  noAction,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  noAction: boolean;
}>) {
  const [selectedKeys, setSelectedKeys] = useState(new Set(["1"]));
  const files = [
    {
      id: 1,
      name: "Messenger.Html",
      date: "2, October 2024",
      icon: DocumentTextIcon,
      color: "bg-red-100 text-red-500",
    },
    {
      id: 2,
      name: "Chapter1.MP4",
      date: "3, October 2024",
      icon: FilmIcon,
      color: "bg-green-100 text-green-500",
    },
    {
      id: 3,
      name: "Salary.Xlsx",
      date: "5, October 2024",
      icon: TableCellsIcon,
      color: "bg-teal-100 text-teal-500",
    },
    {
      id: 4,
      name: "Document.Pdf",
      date: "7, October 2024",
      icon: DocumentIcon,
      color: "bg-yellow-100 text-yellow-500",
    },
    {
      id: 5,
      name: "Details.Txt",
      date: "20, October 2024",
      icon: DocumentTextIcon,
      color: "bg-pink-100 text-pink-500",
    },
    {
      id: 6,
      name: "Messenger.Html",
      date: "2, October 2024",
      icon: DocumentTextIcon,
      color: "bg-green-100 text-green-500",
    },
  ];
  const [openChangeNameModal, setOpenChangeNameModal] = useState(false);
  const [openChangeLeavingModal, setOpenChangeLeavingModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberIdToDelete, setMemberIdToDelete] = useState<string | null>(null);
  const [openChangeNickNameModal, setOpenChangeNickNameModal] = useState(false);
  const [openAddMemberModal, setOpenAddMemberModal] = useState(false);
  const roomState = useRoomStore((state) => state);
  const userState = useAuthStore((state) => state);
  const user = userState.user;
  const isAdmin = roomState.room?.members?.some(
    (member) => member.id === user?.id && member.role === "admin"
  );
  const role: Record<string, string> = {
    admin: "Quản trị viên",
    member: "Thành viên",
    owner: "chủ sở hữu",
    guest: "Khách",
  };
  const router = useRouter();
  const handleChatPrivate = (id: string) => {
    roomState.createRoom("private", `Chat với ${id}`, [id]);
    router.push(`/chat?chatId=${id}`);
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
                          title="Tuỳ chỉnh về đoạn chat"
                        >
                          <div className="w-full">
                            {roomState.room?.type !== "private" && (
                              <>
                                <Button
                                  className="w-full justify-start"
                                  variant="light"
                                  onPress={() => setOpenChangeNameModal(true)}
                                  startContent={
                                    <PencilIcon className="w-4 h-4 text-gray-400" />
                                  }
                                >
                                  Thay đổi trên đoạn chat
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
                                  label="Thay đổi ảnh"
                                  className="w-full justify-start"
                                  variant="light"
                                />
                              </>
                            )}
                            <Button
                              className="w-full justify-start"
                              variant="light"
                              onPress={() => setOpenChangeNickNameModal(true)}
                              startContent={
                                <PencilIcon className="w-4 h-4 text-gray-400" />
                              }
                            >
                              Chỉnh sửa biệt danh
                            </Button>
                          </div>
                        </AccordionItem>
                      ),
                      roomState.room?.type === "group" ||
                      roomState.room?.type === "channel" ? (
                        <AccordionItem
                          key="2"
                          aria-label="Accordion 2"
                          title="Thành viên trong đoạn chat"
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
                                        Gửi tin nhắn riêng tư
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
                                        Xem trang cá nhân
                                      </Button>
                                    </DropdownItem>
                                    {isAdmin ? (
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
                                          Xoá khỏi nhóm
                                        </Button>
                                      </DropdownItem>
                                    ) : null}
                                  </DropdownMenu>
                                </Dropdown>
                              )}
                            </div>
                          ))}
                          {!noAction && (
                            <Button
                              className="w-full justify-start"
                              variant="light"
                              onPress={() => setOpenAddMemberModal(true)}
                              startContent={
                                <UserPlusIcon className="w-4 h-4 text-gray-400" />
                              }
                            >
                              Thêm thành viên
                            </Button>
                          )}
                        </AccordionItem>
                      ) : null,
                      <AccordionItem
                        key="3"
                        aria-label="Accordion 3"
                        title="file phương tiện file liên kết"
                      >
                        <div className="mb-6">
                          <Tabs
                            defaultSelectedKey="docs"
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
                            <Tab key="media" title="Media" />
                            <Tab key="link" title="Link" />
                            <Tab key="docs" title="Docs" />
                          </Tabs>
                        </div>

                        <div className="space-y-4">
                          {files.map((file) => (
                            <Card
                              key={file.id}
                              className="shadow-none border border-gray-100"
                            >
                              <CardBody className="flex flex-row items-center justify-between p-4">
                                <div className="flex items-center gap-4">
                                  <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center ${file.color}`}
                                  >
                                    <file.icon className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-gray-800">
                                      {file.name}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                      {file.date}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <ArrowDownTrayIcon className="w-5 h-5" />
                                  </Button>
                                </div>
                              </CardBody>
                            </Card>
                          ))}
                        </div>
                      </AccordionItem>,
                      <AccordionItem
                        key="4"
                        aria-label="Accordion 4"
                        title="Quyền riêng tư và hỗ trợ"
                      >
                        <Button
                          className="w-full justify-start"
                          variant="light"
                          startContent={
                            <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
                          }
                        >
                          <div className="flex flex-col items-start justify-start">
                            <h2 className="font-bold">Báo cáo</h2>
                            <span className="text-gray-400">
                              Đóng góp về cuộc trò truy
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
                              Rời nhóm
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
                          >
                            {roomState.room?.isBlocked ? "Bỏ chặn" : "Chặn"}
                          </Button>
                        )}
                      </AccordionItem>,
                      <AccordionItem
                        key="5"
                        aria-label="Accordion 5"
                        title="Lịch sử hoạt động"
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
    </>
  );
}
