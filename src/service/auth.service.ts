import { AuthResponse, ForgotPasswordPayload, PayloadLogin, PayloadRegister, ResetPasswordPayload } from "@/types/auth.type";
import apiService from "./api.service";


export default class AuthService {

    static login(data: PayloadLogin) {
        return apiService.post<AuthResponse>('/auth/login', data);
    }

    static register(data: PayloadRegister) {
        const params: any = data;
        if (params.type === 'phone') {
            params.phone = params.username;
            delete params.username;
        } else {
            params.email = params.username;
            delete params.username;
        }
        return apiService.post<AuthResponse>('/auth/register', params);
    }

    static logout() {
        return apiService.post<AuthResponse>('/auth/logout');
    }

    static forgotPassword(data: Pick<ForgotPasswordPayload, 'email' | 'username'>) {
        return apiService.post<AuthResponse>('/auth/forgot-password', data);
    }

    static async resetPassword(data: ResetPasswordPayload) {
        return (await apiService.setAuthorization(data.token)).post<AuthResponse>('/auth/reset-password', { newPassword: data.newPassword });
    }
}