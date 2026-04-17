"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { app, messaging } from "@/libs/firebase";
import { getToken, onMessage, Messaging } from "firebase/messaging";
import type { FirebaseApp } from "firebase/app";
import { notifyType } from "@/types/socketEvent.type";
import useRoomStore from "@/store/useRoomStore";
import useMessageStore from "@/store/useMessageStore";

type FirebaseContextType = {
  app: FirebaseApp | null;
  messaging: Messaging | null;
  token: string | null;
  message: any;
  requestPermission: () => Promise<void>;
};

import useAlertStore from "@/store/useAlertStore";

const FirebaseContext = createContext<FirebaseContextType | null>(null);

// Module-level lock prevents concurrent getToken calls across re-renders / HMR.
// FCM Registration API has a 5 req/min/user quota — racing calls burn it fast.
let _tokenRequestInFlight: Promise<void> | null = null;

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
  const roomState = useRoomStore((state) => state);
  const messageState = useMessageStore((state) => state);
  // Load token từ localStorage khi mount
  useEffect(() => {
    if (!isBrowser) return;

    const savedToken = localStorage.getItem("fcm-token");
    if (savedToken) {
      setToken(savedToken);
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
          { scope: "/" },
        );

        const readyReg = await navigator.serviceWorker.ready;

        // ĐĂNG KÝ FOREGROUND MESSAGE
        unsubscribe = onMessage(messaging, (payload) => {
          setMessage(payload);

          // Hiển thị native notification khi app đang mở (tuỳ thích)
          if (Notification.permission === "granted") {
            const notificationTitle =
              payload.notification?.title ||
              payload.data?.title ||
              "Tin nhắn mới";
            let chatId: string | undefined;
            const room = payload.data?.room;
            if (typeof room === "object" && room !== null && "id" in room) {
              chatId = (room as { id?: string }).id;
            } else {
              chatId = room;
            }
            const url =
              payload.data?.type === notifyType.noify_new_message
                ? `/chat?chatId=${chatId}`
                : "/";
            if (payload.data?.type === notifyType.noify_new_message) {
              const roomData = payload.data?.room;
              if (typeof roomData === "object" && roomData !== null) {
                roomState.updateRoomSocket(roomData);
                // Ensure message is of type MessageType before calling upsetMsg
                const msgData = payload.data?.message;
                if (msgData && typeof msgData === "string") {
                  try {
                    const parsedMsg = JSON.parse(msgData);
                    messageState.upsetMsg(parsedMsg);
                  } catch (e) {
                    console.warn(
                      "Failed to parse message string to MessageType:",
                      msgData,
                      e,
                    );
                  }
                } else if (msgData) {
                  // If msgData is not a string, but not MessageType, try to parse if possible
                  if (typeof msgData === "string") {
                    try {
                      const parsedMsg = JSON.parse(msgData);
                      messageState.upsetMsg(parsedMsg);
                    } catch (e) {
                      console.warn(
                        "Failed to parse message string to MessageType:",
                        msgData,
                        e,
                      );
                    }
                  } else {
                    messageState.upsetMsg(msgData);
                  }
                }
              } else {
                // If roomData is a string, you need to fetch or construct a roomType object here.
                if (typeof roomData === "object" && roomData !== null) {
                  roomState.updateRoomSocket(roomData);
                } else {
                  console.warn(
                    "Invalid room data for updateRoomSocket:",
                    roomData,
                  );
                }
              }
            }
            const notificationOptions: NotificationOptions = {
              body: payload.notification?.body || payload.data?.body || "",
              icon: payload.notification?.icon || "/icons/icon-192x192.png",
              badge: "/icons/badge-72x72.png",
              tag: payload.data?.roomId || "default",
              data: { ...payload.data, url },
              requireInteraction: false,
            };

            const notification = new Notification(
              notificationTitle,
              notificationOptions,
            );
            notification.onclick = () => {
              const d = notification.data as any;
              const url = d?.url || "/";
              window.focus();
              window.location.href = url;
            };
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
  const requestPermission = useCallback(async () => {
    // De-dupe concurrent calls — React StrictMode, HMR, and multiple useEffects
    // can trigger this in quick succession, burning the 5 req/min FCM quota.
    if (_tokenRequestInFlight) return _tokenRequestInFlight;

    _tokenRequestInFlight = (async () => {
    try {
      if (!isBrowser) return;
      if (!messaging) {
        console.error("❌ Firebase messaging not initialized");
        return;
      }

      if (!("Notification" in window)) {
        console.error("❌ Browser doesn't support notifications");
        useAlertStore.getState().showAlert({
          title: "Lỗi",
          message: "Trình duyệt của bạn không hỗ trợ thông báo",
          type: "error",
        });
        return;
      }

      // If permission already granted and we have a cached token → reuse it.
      // This is the main guard against hitting FCM Registration API quota
      // (5 requests/minute/user by default).
      if (Notification.permission === "granted") {
        const cached = localStorage.getItem("fcm-token");
        if (cached) {
          setToken(cached);
          return;
        }
      }

      // If permission already denied, don't show the prompt again (it won't appear
      // anyway — browsers block re-prompts — and it wastes a getToken call).
      if (Notification.permission === "denied") {
        console.warn("🚫 Notification permission was denied previously");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        console.warn("🚫 Notification permission denied");
        return;
      }

      // Double-check cache after permission prompt (user may have granted in another tab)
      const cachedAfterPermission = localStorage.getItem("fcm-token");
      if (cachedAfterPermission) {
        setToken(cachedAfterPermission);
        return;
      }

      // Register SW explicitly and wait for it to be active + controlling the page
      const reg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );

      // Wait for the SW to reach 'activated' state if it isn't already
      await new Promise<void>((resolve) => {
        if (reg.active) {
          resolve();
          return;
        }
        const sw = reg.installing ?? reg.waiting;
        if (!sw) {
          navigator.serviceWorker.ready.then(() => resolve());
          return;
        }
        const handleState = () => {
          if (sw.state === "activated") {
            sw.removeEventListener("statechange", handleState);
            resolve();
          }
        };
        sw.addEventListener("statechange", handleState);
      });

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.error("❌ NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set in .env.local");
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      const t = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (t) {
        setToken(t);
        localStorage.setItem("fcm-token", t);
      } else {
        console.error("❌ No registration token available");
      }
    } catch (err: any) {
      const code = err?.code;
      if (code === "messaging/token-subscribe-failed") {
        const msg = err?.message || "";
        if (msg.includes("Quota exceeded")) {
          console.warn(
            "⚠️ FCM quota exceeded (5 req/min/user). Wait 1 minute and retry. " +
              "Cached token will be reused once present.",
          );
        } else {
          console.error(
            "❌ FCM subscribe failed — verify:\n" +
              "  1. API key restrictions allow current origin + FCM APIs\n" +
              "  2. VAPID key matches Firebase Console Web Push certificate",
            err,
          );
        }
      } else if (code === "messaging/permission-blocked") {
        console.warn("🚫 Notification permission blocked");
      } else {
        console.error("❌ Error getting FCM token:", err);
      }
    }
    })();

    try {
      await _tokenRequestInFlight;
    } finally {
      _tokenRequestInFlight = null;
    }
  }, [isBrowser, messaging]);

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
