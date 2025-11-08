import apiService from "./api.service";

export class NotificationService {
  /**
   * Đăng ký FCM token với server
   */
  static async registerToken(token: string): Promise<any> {
    try {
      const userAgent =
        typeof navigator === "undefined" ? "Unknown" : navigator.userAgent;

      const response = await apiService.post("/notifications/register", {
        token,
        platform: "web",
        userAgent,
      });
      return response.data;
    } catch (error) {
      console.error("❌ Error registering FCM token:", error);
      throw error;
    }
  }

  /**
   * Xóa FCM token khỏi server
   */
  static async unregisterToken(token: string): Promise<any> {
    try {
      const response = await apiService.delete("/notifications/unregister", {
        data: { token },
      });
      return response.data;
    } catch (error) {
      console.error("❌ Error unregistering FCM token:", error);
      throw error;
    }
  }

  /**
   * Cập nhật FCM token (khi token refresh)
   */
  static async updateToken(oldToken: string, newToken: string): Promise<any> {
    try {
      const response = await apiService.put("/notifications/update-token", {
        oldToken,
        newToken,
      });
      return response.data;
    } catch (error) {
      console.error("❌ Error updating FCM token:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách thông báo của user
   */
  static async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  }): Promise<any> {
    try {
      const response = await apiService.get("/notifications", { params });
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      throw error;
    }
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  static async markAsRead(notificationId: string): Promise<any> {
    try {
      const response = await apiService.put(
        `/notifications/${notificationId}/read`
      );
      return response.data;
    } catch (error) {
      console.error("❌ Error marking notification as read:", error);
      throw error;
    }
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  static async markAllAsRead(): Promise<any> {
    try {
      const response = await apiService.put("/notifications/read-all");
      return response.data;
    } catch (error) {
      console.error("❌ Error marking all notifications as read:", error);
      throw error;
    }
  }

  /**
   * Xóa thông báo
   */
  static async deleteNotification(notificationId: string): Promise<any> {
    try {
      const response = await apiService.delete(
        `/notifications/${notificationId}`
      );
      return response.data;
    } catch (error) {
      console.error("❌ Error deleting notification:", error);
      throw error;
    }
  }
}
