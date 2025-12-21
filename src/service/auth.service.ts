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

  static logout() {
    return apiService.post<AuthResponse>("/auth/logout");
  }

  static forgotPassword(
    data: Pick<ForgotPasswordPayload, "email" | "username">
  ) {
    return apiService.post<AuthResponse>("/auth/forgot-password", data);
  }

  static async resetPassword(data: ResetPasswordPayload) {
    return (await apiService.setAuthorization(data.token)).post<AuthResponse>(
      "/auth/reset-password",
      { newPassword: data.newPassword }
    );
  }

  static searchUser(params: {
    keyword: string;
    page?: number;
    limit?: number;
  }) {
    return apiService.get("/auth/search", params);
  }

  static refreshToken(token: string) {
    // Sử dụng axios instance trực tiếp để custom header cho request này
    return apiService.axios.post<AuthResponse>(
      "/auth/refresh-token",
      {},
      {
        headers: {
          "x-refresh-token": token,
          Authorization: "", // Xoá Bearer cũ để tránh conflict middleware
        },
      }
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
}
