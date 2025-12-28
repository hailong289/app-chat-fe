"use client";

import React, { useEffect } from "react";
import { XMarkIcon, CheckIcon, BellIcon } from "@heroicons/react/24/outline";
import { XMarkIcon as XMarkIconSolid } from "@heroicons/react/24/solid";
import {
  Avatar,
  Button,
  Tooltip,
  Spinner,
  ScrollShadow,
  Chip,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import useCounterStore from "@/store/useCounterStore";
import useNotificationStore from "@/store/useNotificationStore";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

const formatRelativeTime = (value: string | null) => {
  if (!value) return "Vừa xong";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: vi,
  });
};

const Notification: React.FC = () => {
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (isCollapsed) {
    return (
      <div className="w-full h-full flex flex-col items-center py-4 bg-background/80 border-r border-divider">
        <Tooltip content="Đóng danh sách" placement="right">
          <Button
            isIconOnly
            variant="light"
            className="text-default-500 mb-4"
            onPress={handleClose}
          >
            <XMarkIconSolid className="w-6 h-6" />
          </Button>
        </Tooltip>
        <ScrollShadow className="flex-1 w-full flex flex-col items-center gap-3 px-2 [&::-webkit-scrollbar]:hidden">
          {notifications.slice(0, 8).map((item) => (
            <Tooltip key={item._id} content={item.title} placement="right">
              <div className="relative">
                {item.sender?.avatar ? (
                  <Avatar
                    src={item.sender.avatar}
                    size="sm"
                    className="cursor-pointer"
                  />
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer bg-primary`}
                  >
                    {(item.sender?.fullname || item.title || "S")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                {!item.isRead && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-danger rounded-full border-2 border-background" />
                )}
              </div>
            </Tooltip>
          ))}
        </ScrollShadow>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-background text-foreground border-r border-divider">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-divider bg-background/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold leading-tight">Thông báo</h2>
            {unreadCount > 0 && (
              <Chip
                size="sm"
                color="danger"
                variant="flat"
                className="h-5 px-1"
              >
                {unreadCount} mới
              </Chip>
            )}
          </div>
          <p className="text-xs text-default-500 mt-0.5">
            Cập nhật mới nhất của bạn
          </p>
        </div>
        <div className="flex gap-1">
          <Tooltip content="Đánh dấu tất cả đã đọc">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="text-default-500 hover:text-primary"
              onPress={() => markAllAsRead()}
            >
              <CheckIcon className="w-5 h-5" />
            </Button>
          </Tooltip>
          <Tooltip content="Đóng">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              className="text-default-500 hover:text-foreground"
              onPress={handleClose}
            >
              <XMarkIcon className="w-6 h-6" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* List */}
      <ScrollShadow className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Spinner size="lg" color="primary" />
            <p className="text-sm text-default-400">Đang tải thông báo...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 px-6 text-center">
            <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mb-4 text-default-400">
              <BellIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Không có thông báo
            </h3>
            <p className="text-sm text-default-500 mt-1">
              Bạn chưa có thông báo nào mới. Hãy quay lại sau nhé!
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {notifications.map((item) => (
              <div
                key={item._id}
                className={`group relative w-full p-4 border-b border-divider transition-all duration-200 cursor-pointer hover:bg-default-100/50 ${
                  !item.isRead
                    ? "bg-primary-50/40 dark:bg-primary-900/10"
                    : "bg-transparent"
                }`}
                onClick={() => !item.isRead && markAsRead(item._id)}
              >
                <div className="flex gap-3.5">
                  {/* Avatar */}
                  <div className="mt-0.5 shrink-0">
                    {item.sender?.avatar ? (
                      <Avatar
                        src={item.sender.avatar}
                        size="md"
                        isBordered={!item.isRead}
                        color={!item.isRead ? "primary" : "default"}
                        className="w-10 h-10"
                      />
                    ) : (
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm ${
                          !item.isRead
                            ? "bg-primary shadow-primary/20"
                            : "bg-default-400"
                        }`}
                      >
                        {(item.sender?.fullname || item.title || "S")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-0.5">
                      <h4
                        className={`text-sm leading-tight truncate pr-6 ${
                          !item.isRead
                            ? "font-bold text-foreground"
                            : "font-medium text-foreground/90"
                        }`}
                      >
                        {item.title}
                      </h4>
                      <span className="text-[10px] text-default-400 whitespace-nowrap shrink-0 font-medium">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`text-xs line-clamp-2 leading-relaxed ${
                        !item.isRead
                          ? "text-foreground/80 font-medium"
                          : "text-default-500"
                      }`}
                    >
                      {item.message}
                    </p>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip content="Xóa thông báo" delay={1000}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="text-default-400 hover:text-danger hover:bg-danger/10 w-7 h-7 min-w-7"
                      onClick={(event) => {
                        event.stopPropagation(); // Prevent triggering markAsRead
                        removeNotification(item._id);
                      }}
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollShadow>
    </div>
  );
};

export default Notification;
