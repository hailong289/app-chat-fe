import {
  AuthResponse,
  ForgotPasswordPayload,
  PayloadLogin,
  PayloadRegister,
  ResetPasswordPayload,
  UpdateAvatarPayload,
  UpdateProfilePayload,
  UpdatePasswordPayload,
} from "@/types/auth.type";
import apiService from "./api.service";

export default class AuthService {
  static login(data: PayloadLogin) {
    return apiService.post<AuthResponse>("/auth/login", data);
  }

  static register(data: PayloadRegister) {
    const params: any = data;
    if (params.type === "phone") {
      params.phone = params.username;
      delete params.username;
    } else {
      params.email = params.username;
      delete params.username;
    }
    return apiService.post<AuthResponse>("/auth/register", params);
  }

  static logout(data?: { fcmToken?: string }) {
    return apiService.post<AuthResponse>("/auth/logout", data);
  }

  /**
   * Fetch the authenticated user's profile. Called on app boot when
   * accessToken is present in localStorage but `user` is not (we
   * intentionally don't persist user info — see useAuthStore partialize).
   */
  static getMe() {
    return apiService.get<AuthResponse>("/auth/me");
  }

  static forgotPassword(
    data: Pick<ForgotPasswordPayload, "email" | "username">,
  ) {
    return apiService.post<AuthResponse>("/auth/forgot-password", data);
  }

  static async resetPassword(data: ResetPasswordPayload) {
    return (await apiService.setAuthorization(data.token)).post<AuthResponse>(
      "/auth/reset-password",
      { newPassword: data.newPassword },
    );
  }

  static searchUser(params: {
    keyword: string;
    page?: number;
    limit?: number;
  }) {
    return apiService.get("/auth/search", params);
  }

  static refreshToken() {
    // No body, no header. BE reads refreshToken from the HttpOnly cookie
    // (path: /auth, auto-sent by the browser via withCredentials). The
    // empty Authorization header prevents middleware from treating this
    // as an access-token request — refresh endpoint must use the
    // refresh-token branch.
    return apiService.axios.post<AuthResponse>(
      "/auth/refresh-token",
      {},
      { headers: { Authorization: "" } },
    );
  }

  static updateProfile(data: UpdateProfilePayload) {
    return apiService.post<AuthResponse>("/auth/update-profile", data);
  }

  static updateAvatar(data: UpdateAvatarPayload) {
    return apiService.post<AuthResponse>("/auth/update-avatar", data);
  }

  static updatePassword(data: UpdatePasswordPayload) {
    return apiService.post<AuthResponse>("/auth/update-password", data);
  }

  static listSessions() {
    return apiService.get<{ data: { metadata: DeviceSession[] } }>(
      "/auth/sessions",
    );
  }

  static logoutDevice(clientId: string) {
    return apiService.post<AuthResponse>(
      `/auth/sessions/${encodeURIComponent(clientId)}/revoke`,
    );
  }

  static logoutAllDevices() {
    return apiService.post<AuthResponse>("/auth/sessions/revoke-all");
  }
}

export interface DeviceSession {
  clientId: string;
  ip: string | null;
  userAgent: string | null;
  deviceInfo: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    deviceType?: string;
    deviceVendor?: string;
    deviceModel?: string;
  } | null;
  location: {
    country?: string;
    countryName?: string;
    region?: string;
    city?: string;
    timezone?: string;
  } | null;
  lastSeenAt: string | null;
  lastSeenIp: string | null;
  revokedAt: string | null;
  revokedReason:
    | "logout"
    | "logout_all"
    | "logout_device"
    | "admin_revoke"
    | null;
  createdAt: string | null;
  isCurrent: boolean;
}
