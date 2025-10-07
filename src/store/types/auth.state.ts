import { ForgotPasswordPayload, PayloadLogin, PayloadRegister, ResetPasswordPayload, User } from "@/types/auth.type";

export interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
    tokens: {
        accessToken: string | null;
        refreshToken: string | null;
        expiresIn: number;
        expiredAt: number;
    } | null;
    login: (payload: PayloadLogin) => void;
    register: (payload: PayloadRegister) => void;
    logout: (callback?: (error?: any) => void) => void;
    setAuth: (isAuthenticated: boolean) => void;
    forgotPassword: (payload: ForgotPasswordPayload) => void;
    resetPassword: (payload: ResetPasswordPayload) => void;
}