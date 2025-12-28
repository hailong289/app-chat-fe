import { create } from "zustand";
import { NotificationState, Notification } from "./types/notification.state";
import { NotificationService } from "@/service/notification.service";

const normalizeTimestamp = (value: any): string | null => {
  if (!value) return null;

  const asDate = (input: Date | number) => {
    const date = new Date(input);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  if (value instanceof Date) {
    return asDate(value.getTime());
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : asDate(numeric);
  }

  if (typeof value === "number") {
    return asDate(value);
  }

  if (typeof value === "object") {
    const seconds =
      "seconds" in value
        ? Number(value.seconds)
        : "_seconds" in value
        ? Number(value._seconds)
        : undefined;
    const nanos =
      "nanos" in value
        ? Number(value.nanos)
        : "_nanoseconds" in value
        ? Number(value._nanoseconds)
        : 0;

    if (seconds !== undefined && !Number.isNaN(seconds)) {
      const millis = seconds * 1000 + Math.floor((nanos || 0) / 1_000_000);
      return asDate(millis);
    }
  }

  return null;
};

const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await NotificationService.getNotifications();
      // Adjust based on actual API response structure
      const rawNotifications = response.metadata?.notifications || [];
      const notifications: Notification[] = rawNotifications.map((n: any) => ({
        _id: n.noti_id || n._id,
        userId: n.noti_userId,
        title: n.noti_title,
        message: n.noti_content,
        type: n.noti_type,
        data: n.noti_metadata,
        isRead: n.noti_read,
        createdAt: normalizeTimestamp(n.createdAt),
        updatedAt: normalizeTimestamp(n.updatedAt),
        sender: n.noti_metadata?.sender || null,
      }));

      const unreadCount = notifications.filter((n) => !n.isRead).length;

      set({ notifications, unreadCount, isLoading: false });
    } catch (error: any) {
      set({
        error: error.message || "Failed to fetch notifications",
        isLoading: false,
      });
    }
  },

  markAsRead: async (id: string) => {
    try {
      // Optimistic update
      set((state) => {
        const notifications = state.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        );
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return { notifications, unreadCount };
      });

      await NotificationService.markAsRead(id);
    } catch (error: any) {
      // Revert if failed (optional, or just show error)
      console.error("Failed to mark notification as read", error);
      // Could fetch notifications again to sync state
    }
  },

  markAllAsRead: async () => {
    try {
      // Optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));

      await NotificationService.markAllAsRead();
    } catch (error: any) {
      console.error("Failed to mark all notifications as read", error);
      get().fetchNotifications(); // Sync state on error
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => {
      const notifications = [notification, ...state.notifications];
      const unreadCount = state.unreadCount + (notification.isRead ? 0 : 1);
      return { notifications, unreadCount };
    });
  },

  removeNotification: async (id: string) => {
    try {
      // Optimistic update
      set((state) => {
        const notificationToRemove = state.notifications.find(
          (n) => n._id === id
        );
        const notifications = state.notifications.filter((n) => n._id !== id);

        let unreadCount = state.unreadCount;
        if (notificationToRemove && !notificationToRemove.isRead) {
          unreadCount = Math.max(0, unreadCount - 1);
        }

        return { notifications, unreadCount };
      });

      await NotificationService.deleteNotification(id);
    } catch (error) {
      console.error("Failed to delete notification", error);
      // Optionally revert or fetch
    }
  },
}));

export default useNotificationStore;
