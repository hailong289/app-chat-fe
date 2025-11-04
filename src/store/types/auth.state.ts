import {
  ForgotPasswordPayload,
  PayloadLogin,
  PayloadRegister,
  ResetPasswordPayload,
  User,
} from "@/types/auth.type";

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  tokens: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresIn: number; // (giây) do server trả
    expiredAt: number; // (ms epoch) client tính
  } | null;
  login: (payload: PayloadLogin) => void;
  register: (payload: PayloadRegister) => void;
  logout: (callback?: (error?: any) => void) => void;
  setAuth: (isAuthenticated: boolean) => void;
  forgotPassword: (payload: ForgotPasswordPayload) => void;
  resetPassword: (payload: ResetPasswordPayload) => void;
  //   refreshAccessToken: () => Promise<string | null>;
  //   getValidAccessToken: () => Promise<string | null>;
}
