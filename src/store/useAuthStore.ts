import { create } from "zustand";
import { AuthState } from "./types/auth.state";

const useAuthStore = create<AuthState>((set) => ({
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
}));