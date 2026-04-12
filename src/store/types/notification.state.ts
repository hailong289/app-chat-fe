export interface Notification {
  _id: string;
  userId: string;
  title: string;
  message: string;
  type: string; // 'system' | 'message' | 'friend_request' | ...
  data?: any;
  isRead: boolean;
  createdAt: string | null;
  updatedAt: string | null;

  // Optional fields for UI display if mapped
  sender?: {
    _id: string;
    fullname: string;
    avatar: string;
  };
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => Promise<void>;
}
