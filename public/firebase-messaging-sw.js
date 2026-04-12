/* eslint-disable no-undef */
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js"
);

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

// Activate immediately and claim clients so the SW controls the page right away
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Background message (tab ẩn / tắt)
messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title || payload.data?.title || "Thông báo mới";

  const options = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      "Bạn có thông báo mới",
    icon: payload.notification?.icon || "/logo.png",
    data: {
      url: payload.data?.url || "/",
      ...payload.data,
    },
  };

  self.registration.showNotification(title, options);
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
