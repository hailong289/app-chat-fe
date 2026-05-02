"use client";

import { useEffect, useState } from "react";
import { Avatar, Button, Spinner, Tooltip } from "@heroui/react";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import useNotificationStore from "@/store/useNotificationStore";

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAllAsRead,
    markAsRead,
    removeNotification,
  } = useNotificationStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchNotifications();
  }, [fetchNotifications]);

  if (!mounted) return null;

  const formatRelativeTime = (value: string | null) => {
    if (!value) return t("notifications.justNow");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t("notifications.justNow");
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale: i18n.language === "en" ? enUS : vi,
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-default-200 px-4 py-4 dark:border-default-100 bg-white dark:bg-slate-900 shrink-0">
        <h1 className="text-xl font-bold leading-tight text-foreground">
          {t("notifications.title")}
        </h1>
        <Tooltip content={t("notifications.markAllRead")}>
          <Button
            isIconOnly
            variant="flat"
            color="primary"
            size="sm"
            aria-label={t("notifications.markAllRead")}
            onPress={() => markAllAsRead()}
            isDisabled={!unreadCount}
          >
            <CheckIcon className="h-5 w-5" />
          </Button>
        </Tooltip>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner size="lg" color="primary" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <p className="text-base text-foreground-500">
              {t("notifications.empty")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col pb-24">
            {notifications.map((item) => (
              <li
                key={item._id}
                role="button"
                tabIndex={0}
                onClick={() => !item.isRead && markAsRead(item._id)}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !item.isRead) {
                    markAsRead(item._id);
                  }
                }}
                className={`group flex items-start gap-4 border-b border-default-100 px-4 py-4 transition-colors hover:bg-default-100 dark:border-default-50 dark:hover:bg-default-50 ${
                  !item.isRead ? "bg-primary-50/60 dark:bg-primary-900/15" : ""
                }`}
              >
                {item.sender?.avatar ? (
                  <Avatar
                    src={item.sender.avatar}
                    size="md"
                    className="shrink-0"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                    {(item.sender?.fullname || item.title || "S")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`truncate text-sm font-semibold ${
                        !item.isRead ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {item.title}
                    </p>
                    <span className="shrink-0 text-xs text-foreground-400">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-foreground-500">
                    {item.message}
                  </p>
                </div>

                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  color="danger"
                  aria-label={t("notifications.remove")}
                  className="opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100"
                  onPress={(e) => {
                    // Prevent the row's onClick (markAsRead)
                    (e as unknown as { stopPropagation?: () => void })
                      .stopPropagation?.();
                    removeNotification(item._id);
                  }}
                >
                  <XMarkIcon className="h-5 w-5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
