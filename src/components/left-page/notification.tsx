"use client";

import React, { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/solid";
import { Card, CardBody, Avatar, Button } from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  name: string;
  avatar: string;
  subtitle: string;
  message: string;
  badgeColor?: string;
  badgeText?: string;
}

const Notification: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

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
      badgeColor: "bg-green-500",
      badgeText: "A",
    },
    {
      id: "3",
      name: "Sufiya Elija",
      avatar: "/avatars/sufiya.jpg",
      subtitle: "Comment On your Photo",
      message: "I would suggest you discuss this f…",
    },
    {
      id: "4",
      name: "Pabelo Mukrani",
      avatar: "/avatars/pabelo.jpg",
      subtitle: "Invite Your New Friend",
      message: "I would suggest you discuss this f…",
      badgeColor: "bg-yellow-400",
    },
    {
      id: "5",
      name: "Pabelo Mukrani",
      avatar: "",
      subtitle: "Update Profile Picture",
      message: "I would suggest you discuss this f…",
      badgeColor: "bg-green-500",
      badgeText: "AC",
    },
  ]);

  const handleRemove = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClose = () => {
    router.push(pathname || "/");
  };

  return (
    <Card className="bg-slate-900 w-full h-full shadow-none border-none rounded-none text-gray-100">
      <CardBody className="p-0 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-semibold leading-tight text-gray-100">
              Thông báo
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Lưu trữ và xem lại thông báo của bạn
            </p>
          </div>
          <Button
            isIconOnly
            variant="light"
            className="text-gray-300 hover:text-white hover:bg-slate-800"
            onPress={handleClose}
          >
            <XMarkIcon className="w-7 h-7" />
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-sm text-gray-500">
                Bạn chưa có thông báo nào.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Card
                key={item.id}
                className="mb-0 shadow-none border-b border-slate-800 rounded-none bg-slate-900"
              >
                <CardBody className="flex items-start justify-between px-4 py-4 flex-row">
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
                          item.badgeColor || "bg-green-500"
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
                        <span className="font-semibold leading-tight text-gray-100">
                          {item.name}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-teal-400 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                      <div className="text-sm text-gray-400 mt-1 truncate">
                        {item.message}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    isIconOnly
                    variant="light"
                    className="text-gray-400 hover:text-white hover:bg-slate-800"
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
