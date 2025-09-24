import { create } from "zustand";
import { AuthState } from "./types/auth.state";
import { createJSONStorage, persist } from "zustand/middleware";

// Lưu trạng thái xác thực trong localStorage
const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isAuthenticated: false,
            isLoading: false,
            login: (payload) => {
                set({ isLoading: true });
                if (payload.username === "admin" && payload.password === "password") {
                    set({ isAuthenticated: true, isLoading: false });
                } else {
                    set({ isAuthenticated: false, isLoading: false });
                }
            },
            logout: () => {
                set({ isAuthenticated: false, isLoading: false });
            },
            setAuth: (isAuthenticated) => set({ isAuthenticated }),
        }),
        {
            name: "auth-storage", // unique name
            storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
        }
    )
);