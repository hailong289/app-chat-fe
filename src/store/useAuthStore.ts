import { create } from "zustand";
import { AuthState } from "./types/auth.state";
import { createJSONStorage, persist } from "zustand/middleware";
import AuthService from "@/service/auth.service";
import { deleteCookie, setCookie } from "cookies-next";

// Lưu trạng thái xác thực trong localStorage
const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isAuthenticated: false,
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
                const { username, password } = payload;
                try {
                    const dateNow = Math.floor(Date.now() / 1000)
                    const response = await AuthService.login({ username, password });
                    set({ 
                        isAuthenticated: true, 
                        isLoading: false, user: response.data.metadata?.user, 
                        tokens: {
                            accessToken: response.data.metadata?.accessToken || null,
                            refreshToken: response.data.metadata?.refreshToken || null,
                            expiresIn: response.data.metadata?.expiresIn || 0,
                            expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
                        }
                    });
                    setCookie("tokens", JSON.stringify({
                        accessToken: response.data.metadata?.accessToken || null,
                        refreshToken: response.data.metadata?.refreshToken || null,
                        expiresIn: response.data.metadata?.expiresIn || 0,
                        expiredAt: dateNow + (response.data.metadata?.expiresIn || 0),
                    }), {
                        maxAge: response.data.metadata?.expiresIn || 0,
                        path: "/",
                    });
                    payload.callback?.();
                } catch (error) {
                    set({ isAuthenticated: false, isLoading: false, user: null, tokens: null });
                    payload.callback?.(error);
                }
            },
            register: async (payload) => {
                set({ isLoading: true });
                try {
                    const response = await AuthService.register(payload);
                    set({ isAuthenticated: true, isLoading: false, user: response.data.metadata?.user });
                    payload.callback?.();
                } catch (error) {
                    set({ isAuthenticated: false, isLoading: false, user: null });
                    payload.callback?.(error);
                }
            },
            logout: async (callback) => {
                set({ isLoading: true });
                try {
                    await AuthService.logout();
                    set({ isAuthenticated: false, isLoading: false, user: null, tokens: null });
                    deleteCookie("tokens", { path: "/" });
                    callback?.();
                } catch (error) {
                    callback?.(error);
                }

            },
            setAuth: (isAuthenticated) => set({ isAuthenticated }),
        }),
        {
            name: "auth-storage", // unique name
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
        }
    )
);

export default useAuthStore;