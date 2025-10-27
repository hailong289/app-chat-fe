import { initializeApp, getApps, getApp, setLogLevel  } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Kiểm tra cấu hình Firebase
const requiredConfigKeys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingKeys = requiredConfigKeys.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingKeys.length > 0) {
  console.error('Firebase configuration error: Missing required environment variables:', 
    missingKeys.map(key => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase().replace(/([A-Z])/g, '_$1')}`));
  throw new Error(`Firebase configuration incomplete. Missing: ${missingKeys.join(', ')}`);
}

// Khởi tạo Firebase app và messaging
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const messaging = typeof window !== "undefined" ? getMessaging(app) : null;
setLogLevel('debug');
export { app, messaging, firebaseConfig };
