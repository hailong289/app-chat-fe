export interface PayloadLogin {
  username: string;
  password: string;
  fcmToken: string | null;
  callback?: (error?: any) => void; // Optional callback for success
}

export interface PayloadSendOtp {
  email: string;
  type: "register" | "reset-password";
  callback?: (error?: any) => void;
}

export interface PayloadVerifyOtp {
  indicator: string;
  otp: string;
  type: "register" | "reset-password";
  callback?: (
    result?: { tempRegisterToken?: string; accessToken?: string; valid?: boolean },
    error?: any,
  ) => void;
}

export interface PayloadRegister {
  fullname: string;
  email?: string;
  phone?: string;
  type?: "email" | "phone";
  tempRegisterToken?: string;
  password: string;
  gender: "male" | "female" | "other";
  dateOfBirth: string;
  fcmToken: string | null;
  callback?: (error?: any) => void; // Optional callback for success
}

export interface User {
  _id: string; // mongodb objectId
  id: string;
  fullname: string;
  slug: string;
  email?: string;
  phone: string;
  address?: string;
  avatar: string;
  gender: "male" | "female" | "other";
  dateOfBirth: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthMetadata {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Thời gian token hết hạn (tính bằng giây)
  user: User;
}

export interface AuthResponse {
  message: string;
  statusCode: number;
  reasonStatusCode: string;
  metadata: AuthMetadata | null;
}

export interface ForgotPasswordPayload {
  email: string;
  username: string;
  callback?: (error?: any) => void; // Optional callback for success
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
  callback?: (error?: any) => void; // Optional callback for success
}

export interface UpdateProfilePayload {
  fullname?: string;
  email?: string;
  phone?: string;
  address?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;
  callback?: (error?: any) => void;
}

export interface UpdateAvatarPayload {
  avatarUrl: string;
  callback?: (error?: any) => void;
}

export interface UpdatePasswordPayload {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  callback?: (error?: any) => void;
}
