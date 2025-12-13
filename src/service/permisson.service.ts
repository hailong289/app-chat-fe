import useAlertStore from "@/store/useAlertStore";

export class PermissionService {
  static async requestMicrophoneAccess() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      // Bạn có thể dùng stream này để ghi âm hoặc gửi lên server
    } catch (err) {
      console.error("❌ Microphone access denied:", err);
      useAlertStore.getState().showAlert({
        title: "Lỗi quyền truy cập",
        message:
          "Truy cập micro bị từ chối. Hãy kiểm tra lại cài đặt trình duyệt!",
        type: "error",
      });
    }
  }
}
