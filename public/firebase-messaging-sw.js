/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js"
);

console.log("[SW] firebase-messaging-sw.js loaded");

// === CONFIG – copy từ Firebase console vào đây (public được) ===
firebase.initializeApp({
  apiKey: "AIzaSyA-KUB8LckCNnxE8aYnL8w7vLTkj--JRug",
  authDomain: "app-chat-2b616.firebaseapp.com",
  projectId: "app-chat-2b616",
  storageBucket: "app-chat-2b616.firebasestorage.app",
  messagingSenderId: "534152738497",
  appId: "1:534152738497:web:c4d090d3726468b10a4640",
  measurementId: "G-VS43FF8TRD",
});

const messaging = firebase.messaging();

// skipWaiting + clients.claim để SW active ngay, không chờ tab reload
self.addEventListener("install", (event) => {
  console.log("[SW] install");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log("[SW] activate");
  event.waitUntil(self.clients.claim());
});

// Background message: chỉ chạy khi tab ẩn hoặc đóng
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] onBackgroundMessage", payload);

  // Forward payload tới tất cả window clients đang mở
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      clientList.forEach((client) => {
        client.postMessage({ type: "FCM_MESSAGE", payload });
      });
    });

  const title =
    payload.notification?.title || payload.data?.title || "Thông báo mới";

  const options = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      "Bạn có thông báo mới",
    icon: payload.notification?.icon || "/logo.png",
    tag: payload.data?.roomId || "default",
    data: {
      url: payload.data?.url || "/",
      ...payload.data,
    },
  };

  return self.registration.showNotification(title, options).then(() => {
    console.log("[SW] showNotification OK");
  }).catch((err) => {
    console.error("[SW] showNotification ERROR:", err);
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const targetUrl = new URL(url, self.location.origin);

        const existing = clientList.find((c) => {
          try {
            const cu = new URL(c.url);
            return cu.origin === targetUrl.origin;
          } catch {
            return false;
          }
        });

        if (existing && "focus" in existing) {
          return existing.focus().then(() => {
            return existing.navigate ? existing.navigate(url) : existing;
          });
        }

        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
