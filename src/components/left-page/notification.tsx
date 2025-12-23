"use client";

import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Card, CardBody, Avatar, Button, Tooltip } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useCounterStore from "@/store/useCounterStore";

interface NotificationItem {
  id: string;
  name: string;
  avatar: string;
  subtitle: string;
  message: string;
  badgeColor?: string; // optional custom tailwind class nếu muốn
  badgeText?: string;
}

const Notification: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "1",
      name: "Josephin water",
      avatar: "/avatars/josephin.jpg",
      subtitle: "Upload New Photos",
      message: "I would suggest you discuss this f…",
    },
    {
      id: "2",
      name: "Jony Today Birthday",
      avatar: "",
      subtitle: "Upload New Photos",
      message: "I would suggest you discuss this f…",
      badgeColor: "bg-success",
      badgeText: "A",
    },
    {
      id: "3",
      name: "Sufiya Elija",
      avatar: "/avatars/sufiya.jpg",
      subtitle: "Comment on your photo",
      message: "I would suggest you discuss this f…",
    },
    {
      id: "4",
      name: "Pabelo Mukrani",
      avatar: "/avatars/pabelo.jpg",
      subtitle: "Invite your new friend",
      message: "I would suggest you discuss this f…",
      badgeColor: "bg-warning",
    },
    {
      id: "5",
      name: "Pabelo Mukrani",
      avatar: "",
      subtitle: "Update profile picture",
      message: "I would suggest you discuss this f…",
      badgeColor: "bg-success",
      badgeText: "AC",
    },
  ]);

  const handleRemove = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClose = () => {
    router.push(pathname || "/");
  };

  if (isCollapsed) {
    return (
      <Card className="w-full h-full shadow-none border-none rounded-none bg-background/80 text-foreground">
        <CardBody className="flex flex-col items-center gap-4 py-4">
          <Tooltip content="Đóng danh sách" placement="right">
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500"
              onPress={handleClose}
            >
              <XMarkIcon className="w-6 h-6" />
            </Button>
          </Tooltip>
          <div className="flex flex-col items-center gap-3">
            {notifications.slice(0, 8).map((item) => (
              <Tooltip key={item.id} content={item.name} placement="right">
                {item.avatar ? (
                  <Avatar
                    src={item.avatar}
                    size="md"
                    className="cursor-pointer"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold cursor-pointer ${
                      item.badgeColor || "bg-primary"
                    }`}
                  >
                    {(
                      item.badgeText ||
                      item.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                    ).slice(0, 2)}
                  </div>
                )}
              </Tooltip>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full shadow-none border-none rounded-none bg-background text-foreground">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-default-200 dark:border-default-100">
          <div>
            <h2 className="text-2xl font-semibold leading-tight">Thông báo</h2>
            <p className="text-sm text-foreground-500 mt-1">
              Lưu trữ và xem lại thông báo của bạn
            </p>
          </div>
          <Button
            isIconOnly
            variant="light"
            className="text-foreground-500 hover:text-foreground hover:bg-default-100"
            onPress={handleClose}
          >
            <XMarkIcon className="w-7 h-7" />
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-sm text-foreground-500">
                Bạn chưa có thông báo nào.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Card
                key={item.id}
                className="mb-0 shadow-none border-b border-default-200 dark:border-default-100 rounded-none bg-background"
              >
                <CardBody className="flex items-start justify-between px-4 py-4 flex-row gap-3">
                  <div className="flex items-start gap-4">
                    {/* Avatar / Badge */}
                    {item.avatar ? (
                      <Avatar
                        src={item.avatar}
                        size="lg"
                        className="min-w-[56px] min-h-[56px]"
                      />
                    ) : (
                      <div
                        className={`min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                          item.badgeColor || "bg-primary"
                        }`}
                      >
                        {item.badgeText ||
                          item.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .toUpperCase()}
                      </div>
                    )}

                    {/* Text */}
                    <div className="max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold leading-tight">
                          {item.name}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-primary mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                      <div className="text-sm text-foreground-500 mt-1 truncate">
                        {item.message}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-foreground-400 hover:text-foreground hover:bg-default-100"
                    onPress={() => handleRemove(item.id)}
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </Button>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default Notification;
