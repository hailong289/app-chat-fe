"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import { ChevronUpIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { Card, CardBody, Avatar, Badge, Button, Tooltip } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useContactStore from "@/store/useContactStore";
import formatTimeAgo from "@/libs/forrmattime";
import useAuthStore from "@/store/useAuthStore";
import useCounterStore from "@/store/useCounterStore";
import { useSocket } from "../providers/SocketProvider";

const Messages: React.FC = () => {
  const contactState = useContactStore((state) => state);
  const authState = useAuthStore((state) => state);
  const router = useRouter();
  const pathname = usePathname();
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);
  const handleClose = () => () => {
    router.push(pathname || "/");
  };
  const { socket } = useSocket("/chat");

  useEffect(() => {
    if (socket && socket.connected) {
      contactState.checkOnlineStatus(socket);
    }
  }, [socket]);

  const recentUpdates = contactState.online.filter(
    (contact) => contact.id !== authState.user?.id,
  );

  if (isCollapsed) {
    return (
      <Card className="bg-white/90 dark:bg-slate-900/80 w-full shadow-none border-none rounded-none">
        <CardBody className="flex flex-col items-center gap-4 py-4">
          <Tooltip content="Trạng thái của tôi" placement="right">
            <Avatar
              src={
                authState.user?.avatar || "https://avatar.iran.liara.run/public"
              }
              name={authState.user?.fullname || "My Status"}
              size="md"
              isBordered
              color="success"
            />
          </Tooltip>

          <div className="flex flex-col items-center gap-3">
            {recentUpdates.slice(0, 6).map((update) => (
              <Tooltip
                key={update.id}
                content={update.fullname}
                placement="right"
              >
                <Badge content=" " color="success" placement="bottom-right">
                  <Avatar
                    src={update.avatar ?? undefined}
                    name={update.fullname}
                    size="md"
                    isBordered
                    className="cursor-pointer"
                    onClick={() => router.push(`/chat?story=${update.id}`)}
                  />
                </Badge>
              </Tooltip>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="bg-white w-full shadow-none border-none rounded-none">
      <CardBody>
        {/* Header with user profile and close button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="relative">
              <Avatar
                src={
                  authState.user?.avatar ||
                  "https://avatar.iran.liara.run/public"
                }
                name={authState.user?.fullname || "My Status"}
                size="lg"
                isBordered
                color="success"
              />
              <div className="absolute bottom-0 right-0 bg-teal-500 rounded-full p-1 border-2 border-white">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3 h-3 text-white"
                >
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-3">
              <h2 className="text-xl font-semibold">Trạng thái của tôi</h2>
              <p className="text-gray-500 text-sm">
                Nhấn để thêm cập nhật trạng thái
              </p>
            </div>
          </div>
          <Button
            isIconOnly
            variant="light"
            className="text-gray-500"
            onPress={handleClose()}
          >
            <XMarkIcon className="w-5 h-5" />
          </Button>
        </div>

        {/* Recent Updates Section */}
        <div className="p-4 bg-green-50 mx-2 my-4 rounded-lg">
          <h3 className="text-lg font-medium text-teal-600">
            Cập nhật gần đây
          </h3>
        </div>

        {/* Recent Updates List */}
        <div className="px-2">
          {recentUpdates.map((update) => (
            <Card
              key={update.id}
              className="mb-2 shadow-none border border-teal-100"
            >
              <CardBody className="flex items-center py-3 flex-row">
                <Badge content=" " color="success" placement="bottom-right">
                  <Avatar
                    src={update.avatar ?? undefined}
                    name={update.fullname}
                    size="md"
                    isBordered
                  />
                </Badge>
                <div className="ml-3">
                  <h4 className="font-medium">{update.fullname}</h4>
                  <p className="text-sm text-gray-500">
                    {update.onlineAt ? formatTimeAgo(update.onlineAt) : ""}
                  </p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </CardBody>
    </Card>
  );
};

export default Messages;
