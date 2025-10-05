import { AuthResponse, PayloadLogin, PayloadRegister } from "@/types/auth.type";
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
}