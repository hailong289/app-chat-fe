"use client";

import { ContactType } from "@/store/types/contact.type";
import {
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Button,
  Divider,
} from "@heroui/react";
import {
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  UserIcon,
  ChatBubbleLeftIcon,
  VideoCameraIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { PlusIcon } from "@heroicons/react/16/solid";
import { useRouter } from "next/navigation";
import useRoomStore from "@/store/useRoomStore";
import useAuthStore from "@/store/useAuthStore";
import useContactStore from "@/store/useContactStore";
import { roomMembers, RoomsState, roomType } from "@/store/types/room.state";
import useCallStore from "@/store/useCallStore";
import { useSocket } from "../providers/SocketProvider";

interface ContactProfileProps {
  contact: ContactType;
}

export default function ContactProfile({
  contact,
}: Readonly<ContactProfileProps>) {
  const contactState = useContactStore((state) => state);
  const router = useRouter();
  const authState = useAuthStore((state) => state);
  const roomState = useRoomStore((state) => state);
  const { openCall } = useCallStore();
  const handleChatPrivate = (id: string) => {
    roomState.createRoom("private", `Chat với ${id}`, [id]);
    router.push(`/chat?chatId=${id}`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === "0") return "Chưa cập nhật";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getGenderText = (gender: string | null) => {
    if (!gender) return "Chưa cập nhật";
    switch (gender.toLowerCase()) {
      case "male":
        return "Nam";
      case "female":
        return "Nữ";
      case "other":
        return "Khác";
      default:
        return "Chưa cập nhật";
    }
  };

  const ButtonHandleAddFriend = () => {
    contactState.sendInvitation({
      userId: authState?.user?.id || "",
      receiverId: contact.id,
    });
  };
  const { socket } = useSocket("/chat");
  const handleStartCall = (id: string, mode: "audio" | "video") => {
    const room = roomState.getRoomByRoomId(id);
    console.log("🚀 ~ handleStartCall ~ room:", room);
    if (!room) return;
    // Same guard as chat/header — openCall crashes if currentUser is
    // null, which can happen briefly while fetchMe() is in flight on
    // app boot.
    if (!authState.user) {
      console.warn("[handleStartCall] no user yet, skipping");
      return;
    }
    openCall({
      roomId: room.roomId || "",
      mode,
      members: room.members.map((m: roomMembers) => ({
        id: m.id,
        fullname: m.name,
        avatar: m.avatar,
        is_caller: true,
      })),
      currentUser: authState.user,
      socket,
      callMode: room.type !== "private" ? "sfu" : "p2p",
    });
  };
  return (
    <div className="h-full bg-background text-foreground overflow-y-auto">
      {/* Header */}
      <Card className="rounded-none shadow-sm dark:bg-slate-900 border-b border-default">
        <CardHeader className="flex justify-between items-center p-4">
          <h2 className="text-lg font-semibold">Thông tin liên hệ</h2>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            className="text-default-500"
            onPress={() => router.push("/?tab=contacts")}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </Button>
        </CardHeader>
      </Card>

      {/* Profile Avatar & Name */}
      <Card className="rounded-none shadow-none border-b border-default dark:bg-slate-900/80">
        <CardBody className="flex flex-col items-center py-8">
          <Avatar
            src={contact.avatar || undefined}
            name={contact.fullname}
            className="w-32 h-32 text-large mb-4"
            isBordered
            color={contact.isOnline ? "success" : "default"}
          />
          <h1 className="text-2xl font-bold mb-1 text-foreground">
            {contact.fullname}
          </h1>

          {contact.isOnline && (
            <p className="text-xs text-success-500">Đang hoạt động</p>
          )}

          {/* Action Buttons */}
          {authState?.user?.id && authState.user.id !== contact.id && (
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              {contact.friendship === "INVALID" && (
                <Button
                  color="default"
                  variant="bordered"
                  startContent={<PlusIcon className="w-5 h-5" />}
                  onPress={ButtonHandleAddFriend}
                >
                  Thêm bạn bè
                </Button>
              )}

              {contact.friendship === "PENDING" && (
                <>
                  {contact.actionUserId === authState.user.id ? (
                    <Button
                      color="default"
                      variant="bordered"
                      startContent={<PlusIcon className="w-5 h-5" />}
                      onPress={() => handleChatPrivate(contact.id)}
                    >
                      Đã gửi lời mời
                    </Button>
                  ) : (
                    <>
                      <Button
                        color="primary"
                        variant="solid"
                        startContent={<PlusIcon className="w-5 h-5" />}
                        onPress={() => handleChatPrivate(contact.id)}
                      >
                        Chấp nhận lời mời
                      </Button>
                      <Button
                        color="default"
                        variant="bordered"
                        startContent={<PlusIcon className="w-5 h-5" />}
                        onPress={() => handleChatPrivate(contact.id)}
                      >
                        Từ chối lời mời
                      </Button>
                    </>
                  )}
                </>
              )}

              <Button
                color="primary"
                variant="solid"
                startContent={<ChatBubbleLeftIcon className="w-5 h-5" />}
                onPress={() => handleChatPrivate(contact.id)}
              >
                Nhắn tin
              </Button>

              {contact.friendship === "ACCEPTED" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    color="default"
                    variant="bordered"
                    startContent={<VideoCameraIcon className="w-5 h-5" />}
                    onPress={() => handleStartCall(contact.id, "video")}
                  >
                    Gọi video
                  </Button>
                  <Button
                    color="default"
                    variant="bordered"
                    isIconOnly
                    startContent={<PhoneIcon className="w-5 h-5" />}
                    onPress={() => handleStartCall(contact.id, "audio")}
                  />
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Contact Information */}
      <Card className="rounded-none shadow-none mt-2 dark:bg-slate-900 border-b border-default">
        <CardHeader className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-default-500 uppercase">
            Thông tin cá nhân
          </h3>
        </CardHeader>
        <CardBody className="px-4 pb-4 space-y-2">
          {/* Phone (chỉ hiện khi là bạn bè) */}
          {contact.friendship === "ACCEPTED" && (
            <>
              <div className="flex items-center gap-3 py-3">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <PhoneIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-default-500">Số điện thoại</p>
                  <p className="text-sm font-medium text-foreground">
                    {contact.phone || "Chưa cập nhật"}
                  </p>
                </div>
              </div>

              <Divider />
            </>
          )}

          {/* Email */}
          <div className="flex items-center gap-3 py-3">
            <div className="p-2 rounded-full bg-success/10 text-success">
              <EnvelopeIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-default-500">Email</p>
              <p className="text-sm font-medium text-foreground">
                {contact.email || "Chưa cập nhật"}
              </p>
            </div>
          </div>

          <Divider />

          {/* Gender */}
          <div className="flex items-center gap-3 py-3">
            <div className="p-2 rounded-full bg-secondary/10 text-secondary">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-default-500">Giới tính</p>
              <p className="text-sm font-medium text-foreground">
                {getGenderText(contact.gender)}
              </p>
            </div>
          </div>

          <Divider />

          {/* Date of Birth */}
          <div className="flex items-center gap-3 py-3">
            <div className="p-2 rounded-full bg-warning/10 text-warning">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-default-500">Ngày sinh</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(contact.dateOfBirth || "")}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Additional Info */}
      <Card className="rounded-none shadow-none mt-2 mb-4 dark:bg-slate-900 border-b border-default">
        <CardHeader className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-default-500 uppercase">
            Thông tin khác
          </h3>
        </CardHeader>
        <CardBody className="px-4 pb-4 space-y-2">
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-xs text-default-500">Ngày tham gia</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(contact.createdAt)}
              </p>
            </div>
          </div>

          <Divider />

          <div className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-xs text-default-500">Cập nhật lần cuối</p>
              <p className="text-sm font-medium text-foreground">
                {formatDate(contact.updatedAt)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
