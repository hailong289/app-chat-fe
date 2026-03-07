import { create } from "zustand";
import { AuthState } from "./types/auth.state";
import { createJSONStorage, persist } from "zustand/middleware";
import AuthService from "@/service/auth.service";
import { deleteCookie, getCookie, setCookie } from "cookies-next";
import Dexie from "dexie";
import * as LocalStorageUtils from "@/utils/localStorage";
import { AuthResponse } from "@/types/auth.type";
import { cleanupFirebaseMessaging, messaging } from "@/libs/firebase";
import useMessageStore from "./useMessageStore";
import useRoomStore from "./useRoomStore";

// Lưu trạng thái xác thực trong localStorage
const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: Boolean(getCookie("tokens")),
      isLoading: false,
      user: null,
      tokens: {
        accessToken: null,
        refreshToken: null,
        expiresIn: 0,
        expiredAt: 0,
      },
      login: async (payload) => {
        set({ isLoading: true });
        const { username, password, fcmToken } = payload;
        try {
          const dateNow = Math.floor(Date.now() / 1000);
          const response = await AuthService.login({
            username,
            password,
            fcmToken,
          });

          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.data.metadata?.user,
            tokens: {
              accessToken: response.data.metadata?.accessToken || null,
              refreshToken: response.data.metadata?.refreshToken || null,
              expiresIn: response.data.metadata?.expiresIn || 0,
              expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
            },
          });
          setCookie(
            "tokens",
            JSON.stringify({
              accessToken: response.data.metadata?.accessToken || null,
              refreshToken: response.data.metadata?.refreshToken || null,
              expiresIn: response.data.metadata?.expiresIn || 0,
              expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
            }),
            {
              maxAge: response.data.metadata?.expiresIn || 0,
              path: "/",
            },
          );
          payload.callback?.();
        } catch (error) {
          set({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: {
              accessToken: null,
              refreshToken: null,
              expiresIn: 0,
              expiredAt: 0,
            },
          });
          payload.callback?.(error);
        }
      },

      register: async (payload) => {
        set({ isLoading: true });
        try {
          const response = await AuthService.register(payload);
          set({
            isAuthenticated: true,
            isLoading: false,
            user: response.data.metadata?.user,
          });
          payload.callback?.();
        } catch (error) {
          set({ isAuthenticated: false, isLoading: false, user: null });
          payload.callback?.(error);
        }
      },
      logout: async (callback) => {
        set({ isLoading: true });
        try {
          let fcmToken: string | undefined;
          if (messaging) {
            try {
              // Try to get the current token to send to backend for cleanup
              // We use the same VAPID key as likely used during login/requestPermission
              const { getToken } = await import("firebase/messaging");
              fcmToken = await getToken(messaging, {
                vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              });
            } catch (err) {
              console.warn(
                "Could not retrieve FCM token for logout cleanup",
                err,
              );
            }
          }

          await AuthService.logout({ fcmToken });

          // Cleanup Firebase
          await cleanupFirebaseMessaging();

          await Dexie.delete("app-chat-db");
          LocalStorageUtils.clearAllLocalStorage();

          // Reset Stores
          useMessageStore.setState({
            messagesRoom: {},
            isLoading: false,
          });
          useRoomStore.setState({
            rooms: [],
            room: null,
            isLoading: false,
          });

          set({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: {
              accessToken: null,
              refreshToken: null,
              expiresIn: 0,
              expiredAt: 0,
            },
          });
          deleteCookie("tokens", { path: "/" });
          callback?.();
          set({ isLoading: false });
        } catch (error) {
          callback?.(error);
        }
      },
      refreshToken: async () => {
        // 1. Lấy refresh token từ state hiện tại
        const currentRefreshToken = get().tokens?.refreshToken;

        // Nếu không có token thì không làm gì cả (hoặc logout)
        if (!currentRefreshToken) {
          get().logout();
          return;
        }

        try {
          // 2. Gọi API Refresh
          const response = await AuthService.refreshToken(currentRefreshToken);
          const dateNow = Math.floor(Date.now() / 1000);

          // Lấy data mới từ response (cấu trúc tuỳ thuộc backend trả về, ở đây giả định giống login)
          const metadata = response.data?.metadata as AuthResponse["metadata"];

          if (
            !metadata ||
            typeof metadata.accessToken !== "string" ||
            typeof metadata.refreshToken !== "string" ||
            typeof metadata.expiresIn !== "number"
          ) {
            throw new Error("No valid metadata returned");
          }

          // 3. Cập nhật State
          set({
            isAuthenticated: true,
            user: (metadata as any).user || get().user, // Giữ user cũ nếu API refresh không trả về user info
            tokens: {
              accessToken: metadata.accessToken,
              refreshToken: metadata.refreshToken, // Update luôn refresh token mới (nếu có xoay vòng)
              expiresIn: metadata.expiresIn,
              expiredAt: dateNow + metadata.expiresIn,
            },
          });

          // 4. Cập nhật Cookie (quan trọng để đồng bộ với Axios Interceptor và SSR)
          setCookie(
            "tokens",
            JSON.stringify({
              accessToken: metadata.accessToken,
              refreshToken: metadata.refreshToken,
              expiresIn: metadata.expiresIn,
              expiredAt: dateNow + metadata.expiresIn,
            }),
            {
              maxAge: metadata.expiresIn,
              path: "/",
            },
          );
        } catch (error: any) {
          console.error("Manual refresh failed:", error?.message || error);
          // 5. Nếu refresh thất bại (token hết hạn hẳn hoặc bị revoke) -> Logout
          get().logout();
        }
      },
      forgotPassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.forgotPassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          payload.callback?.(error);
          set({ isLoading: false });
        }
      },
      resetPassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.resetPassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          payload.callback?.(error);
          set({ isLoading: false });
        }
      },
      updateProfile: async (payload) => {
        set({ isLoading: true });
        try {
          const response = await AuthService.updateProfile(payload);
          const metadata = response.data.metadata as any;

          if (metadata?.user) {
            set({ user: metadata.user, isLoading: false });
          } else {
            // Nếu backend không trả về user mới, tự update local state
            const currentUser = get().user;
            if (currentUser) {
              set({
                user: {
                  ...currentUser,
                  fullname: payload.fullname ?? currentUser.fullname,
                  gender: payload.gender ?? currentUser.gender,
                  dateOfBirth: payload.dateOfBirth ?? currentUser.dateOfBirth,
                  address: payload.address ?? currentUser.address,
                  email: payload.email ?? currentUser.email,
                  phone: payload.phone ?? currentUser.phone,
                },
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          }
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      updateAvatar: async (payload) => {
        set({ isLoading: true });
        try {
          const response = await AuthService.updateAvatar(payload);
          const metadata = response.data.metadata as any;

          if (metadata?.user) {
            set({ user: metadata.user, isLoading: false });
          } else if (metadata?.url) {
            const currentUser = get().user;
            if (currentUser) {
              set({
                user: { ...currentUser, avatar: metadata.url },
                isLoading: false,
              });
            } else {
              set({ isLoading: false });
            }
          } else {
            set({ isLoading: false });
          }
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      updatePassword: async (payload) => {
        set({ isLoading: true });
        try {
          await AuthService.updatePassword(payload);
          set({ isLoading: false });
          payload.callback?.();
        } catch (error) {
          set({ isLoading: false });
          payload.callback?.(error);
        }
      },
      setAuth: (isAuthenticated) => set({ isAuthenticated }),
    }),
    {
      name: "auth-storage", // unique name
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    },
  ),
);

export default useAuthStore;
