export interface User {
  id: number;
  username: string;
  email: string | null;
  role: "admin" | "manager" | "viewer";
  isActive: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
