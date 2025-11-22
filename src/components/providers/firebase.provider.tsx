"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { app, messaging, firebaseConfig } from "@/libs/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import type { FirebaseApp } from "firebase/app";

type FirebaseContextType = {
  app: FirebaseApp | null;
  messaging: Messaging | null;
  token: string | null;
  message: any;
  requestPermission: () => Promise<void>;
};

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export const useFirebase = () => {
  const ctx = useContext(FirebaseContext);
  if (!ctx)
    throw new Error("Dùngg useFirebase phải nằm trong FirebaseProvider");
  return ctx;
};

export const FirebaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<any>(null);

  // Load token từ localStorage khi mount
  useEffect(() => {
    if (globalThis.window === undefined) return;

    const savedToken = localStorage.getItem("fcm-token");
    if (savedToken) {
      setToken(savedToken);
      console.log("✅ Loaded FCM token from localStorage");
    }
  }, []);

  useEffect(() => {
    if (!messaging || globalThis.window === undefined) return;

    async function init() {
      try {
        // Đăng ký service worker
        const reg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          {
            scope: "/",
          }
        );
        console.log("✅ Đã đăng ký Service Worker:", reg);
        // Đợi service worker ready
        const readyReg = await navigator.serviceWorker.ready;
        console.log("✅ Service Worker ready:", readyReg);

        // Gửi cấu hình Firebase với MessageChannel để nhận phản hồi
        if (readyReg.active) {
          const messageChannel = new MessageChannel();

          // Lắng nghe phản hồi từ service worker
          messageChannel.port1.onmessage = (event) => {
            if (event.data.success) {
              console.log(
                "✅ Firebase initialized in service worker successfully"
              );
            } else {
              console.error(
                "❌ Error initializing Firebase in service worker:",
                event.data.error
              );
            }
          };

          // Gửi cấu hình Firebase
          const configMsg = {
            type: "INIT_FIREBASE",
            config: firebaseConfig,
          };

          readyReg.active.postMessage(configMsg, [messageChannel.port2]);
          console.log("📡 Đã gửi cấu hình Firebase vào SW");
        } else {
          console.warn("⚠️ Service worker không active");
        }
      } catch (err) {
        console.error("❌ SW register error:", err);
      }

      // Lắng nghe foreground message (khi app đang mở)
      const unsubscribe = messaging
        ? onMessage(messaging, (payload) => {
            console.log("📩 Foreground message:", payload);
            setMessage(payload);

            // Hiển thị notification thủ công khi app đang mở
            if (Notification.permission === "granted") {
              const notificationTitle =
                payload.notification?.title || "Tin nhắn mới";
              const notificationOptions = {
                body: payload.notification?.body || "",
                icon: payload.notification?.icon || "/icons/icon-192x192.png",
                badge: "/icons/badge-72x72.png",
                tag: payload.data?.roomId || "default",
                data: payload.data,
                requireInteraction: false,
              };

              new Notification(notificationTitle, notificationOptions);
            }
          })
        : () => {};

      return () => {
        unsubscribe();
      }; // cleanup nếu component unmount
    }

    init();
  }, []);

  // Hàm xin quyền và lấy token
  async function requestPermission() {
    try {
      if (!messaging) {
        console.error("❌ Firebase messaging not initialized");
        return;
      }

      // Kiểm tra xem trình duyệt có hỗ trợ không
      if (!("Notification" in globalThis)) {
        console.error("❌ Browser doesn't support notifications");
        alert("Trình duyệt của bạn không hỗ trợ thông báo");
        return;
      }

      // Xin quyền
      const permission = await Notification.requestPermission();
      console.log("🔔 Notification permission:", permission);

      if (permission !== "granted") {
        console.warn("🚫 Notification permission denied");
        return;
      }

      // Đợi service worker ready
      const registration = await navigator.serviceWorker.ready;

      // Lấy token
      const t = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (t) {
        setToken(t);
        console.log("✅ FCM Token:", t);

        // Lưu token vào localStorage để sử dụng sau
        localStorage.setItem("fcm-token", t);

        // Gửi token lên server
        try {
          // Dynamic import để tránh SSR issues
          const { NotificationService } = await import(
            "@/service/notification.service"
          );
          await NotificationService.registerToken(t);
          console.log("✅ Token registered with server");
        } catch (error) {
          console.error("❌ Failed to register token with server:", error);
          // Không throw error để không ảnh hưởng đến flow chính
        }
      } else {
        console.error("❌ No registration token available");
      }
    } catch (err) {
      console.error("❌ Error getting token:", err);
      alert("Có lỗi khi xin quyền thông báo. Vui lòng thử lại.");
    }
  }

  const value: FirebaseContextType = {
    app,
    messaging,
    token,
    message,
    requestPermission,
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};
