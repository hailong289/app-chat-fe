"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { app, messaging } from "@/libs/firebase";
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
  if (!ctx) throw new Error("Dùng useFirebase phải nằm trong FirebaseProvider");
  return ctx;
};

export const FirebaseProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState<any>(null);

  const isBrowser = typeof window !== "undefined";

  // Load token từ localStorage khi mount
  useEffect(() => {
    if (!isBrowser) return;

    const savedToken = localStorage.getItem("fcm-token");
    if (savedToken) {
      setToken(savedToken);
      console.log("✅ Loaded FCM token from localStorage");
    }
  }, [isBrowser]);

  // Đăng ký SW + lắng nghe foreground message
  useEffect(() => {
    if (!isBrowser) return;
    if (!messaging) {
      console.warn("⚠️ Firebase messaging is null, check libs/firebase.ts");
      return;
    }

    let unsubscribe = () => {};

    (async () => {
      try {
        // Đăng ký service worker
        const reg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );
        console.log("✅ Service Worker registered:", reg);

        const readyReg = await navigator.serviceWorker.ready;
        console.log("✅ Service Worker ready:", readyReg);

        // ĐĂNG KÝ FOREGROUND MESSAGE
        unsubscribe = onMessage(messaging, (payload) => {
          console.log("📩 Foreground message:", payload);
          setMessage(payload);

          // Hiển thị native notification khi app đang mở (tuỳ thích)
          if (Notification.permission === "granted") {
            const notificationTitle =
              payload.notification?.title ||
              payload.data?.title ||
              "Tin nhắn mới";

            const notificationOptions: NotificationOptions = {
              body: payload.notification?.body || payload.data?.body || "",
              icon: payload.notification?.icon || "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
              tag: payload.data?.roomId || "default",
              data: payload.data,
              requireInteraction: false,
            };

            new Notification(notificationTitle, notificationOptions);
          }
        });
      } catch (err) {
        console.error("❌ SW register or onMessage error:", err);
      }
    })();

    // cleanup
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [isBrowser, messaging]);

  // Hàm xin quyền và lấy token
  async function requestPermission() {
    try {
      if (!isBrowser) return;
      if (!messaging) {
        console.error("❌ Firebase messaging not initialized");
        return;
      }

      if (!("Notification" in window)) {
        console.error("❌ Browser doesn't support notifications");
        alert("Trình duyệt của bạn không hỗ trợ thông báo");
        return;
      }

      const permission = await Notification.requestPermission();
      console.log("🔔 Notification permission:", permission);

      if (permission !== "granted") {
        console.warn("🚫 Notification permission denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const t = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration,
      });

      if (t) {
        setToken(t);
        console.log("✅ FCM Token:", t);
        localStorage.setItem("fcm-token", t);
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
