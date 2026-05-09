import {
  ForgotPasswordPayload,
  PayloadLogin,
  PayloadRegister,
  ResetPasswordPayload,
  UpdateAvatarPayload,
  UpdateProfilePayload,
  UpdatePasswordPayload,
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
  refreshToken: () => Promise<void>;
  /**
   * Fetch the authenticated user's profile from /auth/me. Called on app
   * bootstrap whenever accessToken is rehydrated from localStorage but
   * `user` is null (we deliberately don't persist user data).
   */
  fetchMe: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => void;
  updateAvatar: (payload: UpdateAvatarPayload) => void;
  updatePassword: (payload: UpdatePasswordPayload) => void;
  // refreshAccessToken: () => Promise<string | null>;
  // getValidAccessToken: () => Promise<string | null>;
}
