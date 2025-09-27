import { PayloadLogin, PayloadRegister, User } from "@/types/auth.type";

export interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
    login: (payload: PayloadLogin) => void;
    register: (payload: PayloadRegister) => void;
    logout: () => void;
    setAuth: (isAuthenticated: boolean) => void;
}