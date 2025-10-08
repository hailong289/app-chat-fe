import axios from "axios";
import { getCookie } from "cookies-next";

class ApiService {
    private static instance: ApiService;
    private axiosInstance;

    private constructor() {
        // Khởi tạo axios instance với cấu hình mặc định
        this.axiosInstance = axios.create({
            baseURL: process.env.API_URL || 'http://localhost:5000/api', // Thay đổi thành URL API thực tế
        });
        this.axiosInstance.interceptors.request.use(async (config) => {
            if (config.data instanceof FormData) {
                config.headers["Content-Type"] = "multipart/form-data";
            } else if (config.data instanceof Blob || config.data instanceof File) {
                config.headers["Content-Type"] = "application/octet-stream";
            } else if (config.data && typeof config.data === "object") {
                config.headers["Content-Type"] = "application/json";
            } else if (typeof config.data === "string" && config.data.includes("=")) {
                config.headers["Content-Type"] = "application/x-www-form-urlencoded";
            } else if (
                config.data instanceof ArrayBuffer ||
                ArrayBuffer.isView(config.data)
            ) {
                config.headers["Content-Type"] = "application/octet-stream";
            } else {
                config.headers["Content-Type"] = "text/plain";
            }
            // Kiểm tra và thêm header Authorization nếu token tồn tại
            const tokens = getCookie("tokens")?.toString();
            if (tokens) {
                const { accessToken: token } = JSON.parse(tokens);
                config.headers["Authorization"] = `Bearer ${token}`;
            }
            return config;
        });

        this.axiosInstance.interceptors.response.use(
            (response) => {
                return response;
            },
            (error) => {
                const statusCode = error.response?.status || 500;
                const reasonStatusCode = error.response?.statusText || "Internal Server Error";

                return Promise.reject({
                    success: false,
                    statusCode,
                    reasonStatusCode,
                    message:
                        (error.response?.data as any)?.message ||
                        error.message ||
                        "Unknown error",
                    metadata: error.response?.data || null,
                });
            }
        );
    }

    public static getInstance(): ApiService {
        if (!ApiService.instance) {
            ApiService.instance = new ApiService();
        }
        return ApiService.instance;
    }

    public get axios() {
        return this.axiosInstance;
    }

    public async get<T>(url: string, params?: any) {
        return await this.axiosInstance.get<T>(url, { params });
    }

    public async post<T>(url: string, data?: any) {
        return await this.axiosInstance.post<T>(url, data);
    }

    public async put<T>(url: string, data?: any) {
        return await this.axiosInstance.put<T>(url, data);
    }

    public async patch<T>(url: string, data?: any) {
        return await this.axiosInstance.patch<T>(url, data);
    }

    public async delete<T>(url: string, data?: any) {
        return await this.axiosInstance.delete<T>(url, { data });
    }

    public async withTimeout<T>(timeoutMs: number) {
        this.axiosInstance.defaults.timeout = timeoutMs;
        return this;
    }

    public async setHeader(key: string, value: string) {
        this.axiosInstance.defaults.headers.common[key] = value;
        return this;
    }

    public async removeHeader(key: string) {
        delete this.axiosInstance.defaults.headers.common[key];
        return this;
    }

    public async setAuthorization(token: string) {
        this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        return this;
    }

    public async setBaseURL(url: string) {
        this.axiosInstance.defaults.baseURL = url;
        return this;
    }
}

export default ApiService.getInstance();