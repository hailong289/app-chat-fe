"use client";

import React, { useEffect } from "react";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/solid";
import {
  Card,
  CardBody,
  Avatar,
  Button,
  Tooltip,
  Spinner,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useCounterStore from "@/store/useCounterStore";
import useNotificationStore from "@/store/useNotificationStore";
import { formatDistanceToNow } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

const Notification: React.FC = () => {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const isCollapsed = useCounterStore((state) => state.collapsedSidebar);
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAllAsRead,
    removeNotification,
    markAsRead,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleClose = () => {
    router.push(pathname || "/");
  };

  const formatRelativeTime = (value: string | null) => {
    if (!value) return t("notifications.justNow");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("notifications.justNow");
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: i18n.language === "en" ? enUS : vi,
    });
  };

  if (isCollapsed) {
    return (
      <Card className="w-full h-full shadow-none border-none rounded-none bg-background/80 text-foreground">
        <CardBody className="flex flex-col items-center gap-4 py-4">
          <Tooltip content={t("notifications.close")} placement="right">
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
              <Tooltip key={item._id} content={item.title} placement="right">
                {item.sender?.avatar ? (
                  <Avatar
                    src={item.sender.avatar}
                    size="md"
                    className="cursor-pointer"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold cursor-pointer bg-primary`}
                  >
                    {(item.sender?.fullname || item.title || "S")
                      .slice(0, 2)
                      .toUpperCase()}
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
            <h2 className="text-2xl font-semibold leading-tight">
              {t("notifications.title")}
            </h2>
            <p className="text-sm text-foreground-500 mt-1">
              {t("notifications.subtitle")}
            </p>
          </div>
          <div className="flex gap-2">
            <Tooltip content={t("notifications.markAllRead")}>
              <Button
                isIconOnly
                variant="light"
                className="text-foreground-500 hover:text-primary"
                onPress={() => markAllAsRead()}
              >
                <CheckIcon className="w-6 h-6" />
              </Button>
            </Tooltip>
            <Button
              isIconOnly
              variant="light"
              className="text-foreground-500 hover:text-foreground hover:bg-default-100"
              onPress={handleClose}
            >
              <XMarkIcon className="w-7 h-7" />
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-sm text-foreground-500">
                {t("notifications.empty")}
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <Card
                key={item._id}
                className={`mb-0 shadow-none border-b border-default-200 dark:border-default-100 rounded-none ${
                  !item.isRead
                    ? "bg-primary-50 dark:bg-primary-900/20"
                    : "bg-background"
                }`}
                isPressable
                onPress={() => !item.isRead && markAsRead(item._id)}
              >
                <CardBody className="flex items-start justify-between px-4 py-4 flex-row gap-3">
                  <div className="flex items-start gap-4 w-full">
                    {/* Avatar / Badge */}
                    {item.sender?.avatar ? (
                      <Avatar
                        src={item.sender.avatar}
                        size="lg"
                        className="min-w-[56px] min-h-[56px]"
                      />
                    ) : (
                      <div
                        className={`min-w-[56px] min-h-[56px] rounded-full flex items-center justify-center text-white text-2xl font-bold bg-primary`}
                      >
                        {(item.sender?.fullname || item.title || "S")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-semibold leading-tight ${
                            !item.isRead ? "text-primary" : ""
                          }`}
                        >
                          {item.title}
                        </span>
                        <span className="text-xs text-foreground-400 whitespace-nowrap">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm text-foreground-500 mt-1 break-words">
                        {item.message}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    className="text-foreground-400 hover:text-danger min-w-8 w-8 h-8"
                    onPress={() => removeNotification(item._id)}
                  >
                    <XMarkIcon className="w-5 h-5" />
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
