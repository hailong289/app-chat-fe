// Import Firebase scripts at the top level (required for service workers)
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging-compat.js');

let initialized = false;
let messaging = null;

// Lắng nghe tin nhắn từ client để khởi tạo Firebase
self.addEventListener('message', async (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE' && !initialized) {
    initialized = true;
    const config = event.data.config;

    try {
      // Khởi tạo Firebase app với config từ client
      firebase.initializeApp(config);
      messaging = firebase.messaging();

      console.log('🔥 Firebase được khởi tạo trong service worker:', config.projectId);

      // Lắng nghe background messages
      messaging.onBackgroundMessage((payload) => {
        console.log('📩 Tin nhắn nền:', payload);
        console.log('🔍 Service Worker instance:', self.registration.scope);

        const notificationTitle = payload.notification?.title || payload.data?.title || 'Thông báo mới';
        const notificationOptions = {
          body: payload.notification?.body || payload.data?.body || 'Bạn có tin nhắn mới',
          icon: payload.notification?.icon || '/logo.png',
          badge: '/logo.png',
          image: payload.notification?.image,
          tag: payload.data?.tag || payload.data?.chatId || 'chat-notification',
          data: {
            click_action: payload.notification?.click_action || payload.data?.click_action || '/',
            url: payload.data?.url || '/',
            ...payload.data
          },
          requireInteraction: false,
          silent: false,
          renotify: true,
          actions: [
            {
              action: 'open',
              title: 'Mở ứng dụng',
              icon: '/logo.png'
            },
            {
              action: 'close',
              title: 'Đóng',
              icon: '/logo.png'
            }
          ]
        };

        console.log('🔔 Đang hiển thị notification với tag:', notificationOptions.tag);
        
        // push notification
        self.registration.showNotification(notificationTitle, notificationOptions);
      });

      // Gửi phản hồi về client khi khởi tạo thành công
      event.ports[0]?.postMessage({ success: true, message: 'Firebase được khởi tạo thành công' });
    } catch (error) {
      console.error('❌Lỗi khởi tạo Firebase trong service worker:', error);
      event.ports[0]?.postMessage({ success: false, error: error.message });
    }
  }
});

// Xử lý khi user click vào thông báo
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification, 'Action:', event.action);
  
  event.notification.close();
  
  // Xử lý các action khác nhau
  if (event.action === 'close') {
    return; // Chỉ đóng notification
  }
  
  const clickUrl = event.notification.data?.url || event.notification.data?.click_action || '/chat';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Tìm tab đang mở
      const existingClient = clientList.find(client => {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(clickUrl, self.location.origin);
        return clientUrl.origin === targetUrl.origin;
      });
      
      if (existingClient && 'focus' in existingClient) {
        // Focus vào tab hiện có và navigate đến URL
        return existingClient.focus().then(() => {
          return existingClient.navigate ? existingClient.navigate(clickUrl) : existingClient;
        });
      }
      
      // Nếu không tìm thấy tab nào, mở tab mới
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    }).catch(error => {
      console.error('❌ Error handling notification click:', error);
    })
  );
});