import {
  initializeApp,
  getApps,
  getApp,
  setLogLevel,
  FirebaseApp,
} from "firebase/app";
import {
  getMessaging,
  getToken,
  onMessage,
  Messaging,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Kiểm tra cấu hình Firebase - chỉ warn trong build time, throw error trong runtime
const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];
const missingKeys = requiredConfigKeys.filter(
  (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
);

if (missingKeys.length > 0) {
  const errorMessage = `Firebase configuration incomplete. Missing: ${missingKeys.join(
    ", "
  )}`;

  // Chỉ warn trong build time, không throw error
  if (
    typeof globalThis.window === "undefined" &&
    process.env.NODE_ENV === "production"
  ) {
    console.warn(
      "⚠️  Firebase configuration warning during build:",
      errorMessage
    );
    console.warn(
      "Firebase features will be disabled until environment variables are provided at runtime."
    );
  } else if (typeof globalThis.window !== "undefined") {
    // Throw error ở client side khi thực sự cần dùng Firebase
    console.error("Firebase configuration error:", errorMessage);
    // Không throw ngay, để app vẫn render được
  }
}

// Khởi tạo Firebase app và messaging - chỉ khi có đủ config
// Using function to avoid ESLint warning about mutable exports
const initializeFirebase = () => {
  if (missingKeys.length === 0) {
    const firebaseApp = !getApps().length
      ? initializeApp(firebaseConfig)
      : getApp();
    const firebaseMessaging =
      typeof globalThis.window !== "undefined"
        ? getMessaging(firebaseApp)
        : null;
    setLogLevel("debug");
    return { app: firebaseApp, messaging: firebaseMessaging };
  }
  return { app: null, messaging: null };
};

const { app, messaging } = initializeFirebase();

export { app, messaging, firebaseConfig };
