import useAuthStore from "@/store/useAuthStore";
import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import {
  awaitAuthInFlight,
  awaitRefreshIfAny,
  isAuthInFlight,
  isRefreshing,
  refreshAccessToken,
} from "@/libs/tokenRefresh";
import { tokenStorage } from "@/utils/tokenStorage";

// Endpoints that MUST NOT trigger refresh-and-retry on 401 — refreshing
// the refresh request itself causes infinite loops; login/register failing
// with 401 is a credentials problem, not a stale-token problem.
const NO_REFRESH_PATHS = [
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/auth/logout",
];

function shouldSkipRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return NO_REFRESH_PATHS.some((p) => url.includes(p));
}

class ApiService {
  private static instance: ApiService;
  private axiosInstance;
  // In-flight GET dedup. Maps a stable key (`GET:url:params-json`) to
  // the pending axios promise. While a request is mid-flight, any
  // caller asking for the SAME (url, params) tuple gets the existing
  // promise instead of firing a duplicate request — same primitive
  // React Query uses internally for query-key dedup.
  //
  // Only GETs are deduped (mutations like POST/PUT/PATCH/DELETE are
  // intentionally NOT — calling submitMessage twice should send two
  // messages, not silently merge them). Entries are cleared in a
  // .finally() so a fresh request can fire as soon as the prior
  // settles. No TTL caching here — that's a separate concern.
  private inFlightGets = new Map<string, Promise<unknown>>();

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
      // refreshToken lives in an HttpOnly cookie scoped to /auth — the
      // browser only auto-sends it across origins when withCredentials
      // is true. Required for /auth/refresh-token to work in dev (FE on
      // :3000, BE on :5000 = cross-origin). For non-auth endpoints the
      // cookie path doesn't match, so nothing extra is leaked.
      withCredentials: true,
    });

    // Request interceptor — sets Content-Type + Authorization. Crucially,
    // BLOCKS until any in-flight refresh completes so we don't fire the
    // request with the about-to-be-invalidated old token.
    this.axiosInstance.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (config.data instanceof FormData) {
          config.headers["Content-Type"] = "multipart/form-data";
        } else if (config.data instanceof Blob || config.data instanceof File) {
          config.headers["Content-Type"] = "application/octet-stream";
        } else if (config.data && typeof config.data === "object") {
          config.headers["Content-Type"] = "application/json";
        } else if (
          typeof config.data === "string" &&
          config.data.includes("=")
        ) {
          config.headers["Content-Type"] = "application/x-www-form-urlencoded";
        } else if (
          config.data instanceof ArrayBuffer ||
          ArrayBuffer.isView(config.data)
        ) {
          config.headers["Content-Type"] = "application/octet-stream";
        } else {
          config.headers["Content-Type"] = "text/plain";
        }

        // If a token refresh is in flight, queue this request behind it.
        // The auth/refresh request itself bypasses this so we don't deadlock.
        if (
          isRefreshing() &&
          !shouldSkipRefresh(config.url)
        ) {
          await awaitRefreshIfAny();
        }

        // If a login/register is in flight, queue non-auth requests so
        // they pick up the new Bearer token instead of firing tokenless
        // (which would 401 → trigger a phantom /auth/refresh that fails
        // because no cookie has been set yet → noisy console.error).
        if (
          isAuthInFlight() &&
          !shouldSkipRefresh(config.url)
        ) {
          await awaitAuthInFlight();
        }

        // Attach Authorization header (read AFTER awaiting refresh so we
        // pick up the new token). Skip if caller explicitly set it.
        // Source: Zustand store (auth-storage in localStorage). Cookie is
        // HttpOnly + scoped to /auth — JS can't read it and it doesn't
        // auto-send to non-auth endpoints anyway, so the store is the
        // only viable source for the Bearer header.
        if (config.headers["Authorization"] === undefined) {
          const token = useAuthStore.getState().tokens?.accessToken;
          if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
          }
        }
        return config;
      },
    );

    // Response interceptor — on 401, attempt refresh-then-retry once.
    // All concurrent 401s share the same in-flight refresh promise via
    // the singleton in libs/tokenRefresh.
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as
          | (InternalAxiosRequestConfig & { _retry?: boolean })
          | undefined;
        const statusCode = error.response?.status || 500;
        const reasonStatusCode =
          error.response?.statusText || "Internal Server Error";
        const responseData = error.response?.data as any;

        // Refresh-and-retry path — 401 + not already retried + not a path
        // that would loop (e.g. /auth/refresh itself).
        if (
          statusCode === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !shouldSkipRefresh(originalRequest.url)
        ) {
          originalRequest._retry = true;
          const newToken = await refreshAccessToken();
          if (newToken) {
            // Update the retried request with the fresh token.
            originalRequest.headers.set?.(
              "Authorization",
              `Bearer ${newToken}`,
            );
            // Fallback for older axios — direct mutation works too.
            (originalRequest.headers as any)["Authorization"] =
              `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          }
          // Refresh failed → fall through to log-out path below.
        }

        // 401 with no recovery available → clear auth, let UI redirect.
        // No JS-side cookie clear: cookie is HttpOnly + scoped to /auth,
        // BE clears it via clearAuthCookie() on logout / refresh-failure.
        // Drop both the in-memory auth flag AND the stored accessToken
        // — otherwise a reload would re-seed isAuthenticated=true from
        // the dead token in localStorage.
        if (statusCode === 401) {
          tokenStorage.clear();
          useAuthStore.getState().setAuth(false);
        }

        return Promise.reject({
          success: false,
          statusCode,
          reasonStatusCode,
          message:
            this.formatValidationErrors(responseData) ||
            responseData?.message ||
            error.message,
          metadata: responseData || null,
        });
      },
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
    // Stable key — params get JSON-stringified so {a:1,b:2} and
    // {b:2,a:1} could differ in theory, but in practice callers pass
    // a stable shape per endpoint, so this is fine.
    const key = `GET:${url}:${params ? JSON.stringify(params) : ""}`;
    const existing = this.inFlightGets.get(key) as
      | Promise<AxiosResponse<T>>
      | undefined;
    if (existing) return existing;
    const promise = this.axiosInstance.get<T>(url, { params }).finally(() => {
      // Clear AFTER settle so the next caller can issue a fresh
      // request. Doing this in finally also clears on error paths
      // (don't want a poisoned key blocking retries forever).
      this.inFlightGets.delete(key);
    });
    this.inFlightGets.set(key, promise);
    return promise;
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
    this.axiosInstance.defaults.headers.common[
      "Authorization"
    ] = `Bearer ${token}`;
    return this;
  }

  public async setBaseURL(url: string) {
    this.axiosInstance.defaults.baseURL = url;
    return this;
  }

  /**
   * Xử lý và format lỗi validation từ API response
   * @param errorData - Dữ liệu lỗi từ API response
   * @returns Chuỗi lỗi đã được format
   */
  private formatValidationErrors(errorData: any): string {
    if (Array.isArray(errorData)) {
      return errorData
        .map((item: any) => {
          if (item.field && item.errors && Array.isArray(item.errors)) {
            return `${item.field}: ${item.errors.join(", ")}`;
          }
          return item.toString();
        })
        .join("; ");
    }

    if (Array.isArray(errorData?.message)) {
      return errorData.message
        .map((item: any) => {
          if (item.field && item.errors && Array.isArray(item.errors)) {
            return `${item.field}: ${item.errors.join(", ")}`;
          }
          return item.toString();
        })
        .join("; ");
    }

    return errorData?.message || errorData?.toString() || "Unknown error";
  }
}

export default ApiService.getInstance();
