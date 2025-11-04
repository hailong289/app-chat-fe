"use client";

import { ContactType } from "@/store/types/contact.type";
import {
  Card,
  CardBody,
  CardHeader,
  Avatar,
  Button,
  Chip,
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
import { useRouter } from "next/navigation";
import useRoomStore from "@/store/useRoomStore";
import useAuthStore from "@/store/useAuthStore";

interface ContactProfileProps {
  contact: ContactType;
}

export default function ContactProfile({
  contact,
}: Readonly<ContactProfileProps>) {
  const router = useRouter();
  const authState = useAuthStore((state) => state);
  console.log("🚀 ~ ContactProfile ~ authState:", authState?.user?.id);
  const roomState = useRoomStore((state) => state);
  const handleChatPrivate = (id: string) => {
    roomState.createRoom("private", `Chat với ${id}`, [id]);
    router.push(`/chat?chatId=${id}`);
  };
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "online":
        return "success";
      case "offline":
        return "default";
      case "busy":
        return "danger";
      case "away":
        return "warning";
      default:
        return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "online":
        return "Đang hoạt động";
      case "offline":
        return "Không hoạt động";
      case "busy":
        return "Bận";
      case "away":
        return "Vắng mặt";
      default:
        return "Không xác định";
    }
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

  return (
    <div className="h-full bg-gray-50 overflow-y-auto">
      {/* Header */}
      <Card className="rounded-none shadow-sm">
        <CardHeader className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Thông tin liên hệ</h2>
          <Button
            isIconOnly
            variant="light"
            size="sm"
            onPress={() => router.push("/?tab=contacts")}
          >
            <EllipsisVerticalIcon className="w-5 h-5" />
          </Button>
        </CardHeader>
      </Card>

      {/* Profile Avatar & Name */}
      <Card className="rounded-none shadow-none border-b">
        <CardBody className="flex flex-col items-center py-8">
          <Avatar
            src={contact.avatar || undefined}
            name={contact.fullname}
            className="w-32 h-32 text-large mb-4"
            isBordered
            // color={getStatusColor(contact.status)}
          />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {contact.fullname}
          </h1>
          <Chip
            //    color={getStatusColor(contact.status)}
            variant="flat"
            size="sm"
          >
            {/* {getStatusText(contact.status)} */}
          </Chip>

          {/* Action Buttons */}
          {authState?.user?.id && authState?.user?.id !== contact.id && (
            <div className="flex gap-3 mt-6">
              <Button
                color="primary"
                startContent={<ChatBubbleLeftIcon className="w-5 h-5" />}
                onPress={() => handleChatPrivate(contact.id)}
              >
                Nhắn tin
              </Button>
              <Button
                color="default"
                variant="bordered"
                startContent={<VideoCameraIcon className="w-5 h-5" />}
              >
                Gọi video
              </Button>
              <Button
                color="default"
                variant="bordered"
                isIconOnly
                startContent={<PhoneIcon className="w-5 h-5" />}
              />
            </div>
          )}
        </CardBody>
      </Card>

      {/* Contact Information */}
      <Card className="rounded-none shadow-none mt-2">
        <CardHeader className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            Thông tin cá nhân
          </h3>
        </CardHeader>
        <CardBody className="px-4 pb-4">
          {/* Phone */}
          <div className="flex items-center gap-3 py-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <PhoneIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Số điện thoại</p>
              <p className="text-sm font-medium text-gray-800">
                {contact.phone || "Chưa cập nhật"}
              </p>
            </div>
          </div>

          <Divider />

          {/* Email */}
          <div className="flex items-center gap-3 py-3">
            <div className="bg-green-100 p-2 rounded-full">
              <EnvelopeIcon className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-800">
                {contact.email || "Chưa cập nhật"}
              </p>
            </div>
          </div>

          <Divider />

          {/* Gender */}
          <div className="flex items-center gap-3 py-3">
            <div className="bg-purple-100 p-2 rounded-full">
              <UserIcon className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Giới tính</p>
              <p className="text-sm font-medium text-gray-800">
                {getGenderText(contact.gender)}
              </p>
            </div>
          </div>

          <Divider />

          {/* Date of Birth */}
          <div className="flex items-center gap-3 py-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <CalendarIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-500">Ngày sinh</p>
              <p className="text-sm font-medium text-gray-800">
                {formatDate(contact.dateOfBirth || "")}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Additional Info */}
      <Card className="rounded-none shadow-none mt-2">
        <CardHeader className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-semibold text-gray-600 uppercase">
            Thông tin khác
          </h3>
        </CardHeader>
        <CardBody className="px-4 pb-4">
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Ngày tham gia</p>
              <p className="text-sm font-medium text-gray-800">
                {formatDate(contact.createdAt)}
              </p>
            </div>
          </div>

          <Divider />

          <div className="flex items-center gap-3 py-3">
            <div className="flex-1">
              <p className="text-xs text-gray-500">Cập nhật lần cuối</p>
              <p className="text-sm font-medium text-gray-800">
                {formatDate(contact.updatedAt)}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Actions */}
      {/* <Card className="rounded-none shadow-none mt-2 mb-4">
        <CardBody className="p-4">
          <Button color="danger" variant="light" fullWidth>
            Chặn liên hệ
          </Button>
          <Button color="default" variant="light" fullWidth className="mt-2">
            Báo cáo
          </Button>
        </CardBody>
      </Card> */}
    </div>
  );
}
