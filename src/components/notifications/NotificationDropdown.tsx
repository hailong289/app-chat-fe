"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollShadow,
  Spinner,
  Tooltip,
} from "@heroui/react";
import { BellIcon } from "@heroicons/react/24/solid";
import {
  CheckIcon,
  XMarkIcon,
} from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import useNotificationStore from "@/store/useNotificationStore";

/**
 * Bell icon trigger + popover panel of notifications. Replaces the old
 * full-page Notification tab — opens inline like Messenger / Facebook.
 * @param mobileMode Khi true, render dạng icon-only không có text (dùng trên Bottom Nav mobile).
 */
export function NotificationDropdown({ mobileMode = false }: { mobileMode?: boolean }) {
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

  // Gate render on `mounted` so the bell button isn't part of SSR
  // output. Reason: i18next's LanguageDetector resolves on the client
  // side AFTER hydration, so server renders aria-label="Thông báo"
  // (fallback locale) while the client wants aria-label="Notifications"
  // (en) — `suppressHydrationWarning` doesn't propagate from
  // HeroUI.Button into the inner DOM <button>, so the warning persists
  // even with the prop set. Skipping SSR is the most reliable fix.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
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
    <Popover placement={mobileMode ? "top" : "right-start"} offset={8}>
      <PopoverTrigger>
        {mobileMode ? (
          // Mobile mode: compact icon-only cho Bottom Nav
          <button
            type="button"
            className="flex flex-col items-center justify-center w-full gap-0.5 text-white/60"
            aria-label={t("notifications.title")}
          >
            <Badge
              color="danger"
              content={unreadCount > 99 ? "99+" : `${Math.max(unreadCount, 0)}`}
              isInvisible={!unreadCount}
              size="sm"
            >
              <BellIcon className="w-6 h-6" />
            </Badge>
            <span className="text-[9px] font-medium leading-none" suppressHydrationWarning>
              {t("sidebar.notifications")}
            </span>
          </button>
        ) : (
          // Desktop mode: full-width button với text
          <Button
            variant="light"
            aria-label={t("notifications.title")}
            suppressHydrationWarning
            className="w-full transition-all relative left-0 top-0 duration-300 justify-start gap-4 text-white dark:text-gray-100"
          >
            <Badge
              color="danger"
              content={unreadCount > 99 ? "99+" : `${Math.max(unreadCount, 0)}`}
              isInvisible={!unreadCount}
            >
              <BellIcon className="relative block min-w-[24px] h-[24px] text-white dark:text-gray-100" />
            </Badge>
            <span
              className="text-white dark:text-gray-100 truncate"
              suppressHydrationWarning
            >
              {t("sidebar.notifications")}
            </span>
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent className="p-0 w-[380px] max-w-[92vw]">
        <div className="flex w-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-default-200 px-4 py-3 dark:border-default-100">
            <h3 className="text-base font-semibold leading-tight">
              {t("notifications.title")}
            </h3>
            <Tooltip content={t("notifications.markAllRead")}>
              <Button
                isIconOnly
                variant="light"
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
          <ScrollShadow className="max-h-[480px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Spinner size="sm" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-foreground-500">
                  {t("notifications.empty")}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col">
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
                    className={`group flex items-start gap-3 border-b border-default-100 px-3 py-3 transition-colors hover:bg-default-100 dark:border-default-50 dark:hover:bg-default-50 ${
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
                          className={`truncate text-sm font-medium ${
                            !item.isRead ? "text-primary" : ""
                          }`}
                        >
                          {item.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-foreground-400">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-foreground-500">
                        {item.message}
                      </p>
                    </div>

                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      aria-label={t("notifications.remove")}
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onPress={(e) => {
                        // Prevent the row's onClick (markAsRead)
                        (e as unknown as { stopPropagation?: () => void })
                          .stopPropagation?.();
                        removeNotification(item._id);
                      }}
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollShadow>
        </div>
      </PopoverContent>
    </Popover>
  );
}
