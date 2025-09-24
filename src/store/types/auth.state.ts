export interface AuthState {
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (payload: { username: string; password: string }) => void;
    logout: () => void;
    setAuth: (isAuthenticated: boolean) => void;
}