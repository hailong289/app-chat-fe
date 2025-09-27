import { create } from "zustand";
import { AuthState } from "./types/auth.state";
import { createJSONStorage, persist } from "zustand/middleware";
import AuthService from "@/service/auth.service";

// Lưu trạng thái xác thực trong localStorage
const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            login: async (payload) => {
                set({ isLoading: true });
                const { username, password } = payload;
                try {
                    const response = await AuthService.login({ username, password });
                    set({ isAuthenticated: true, isLoading: false, user: response.data.metadata?.user });
                    payload.callback?.();
                } catch (error) {
                    set({ isAuthenticated: false, isLoading: false, user: null });
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
            logout: () => {
                set({ isAuthenticated: false, isLoading: false, user: null });
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