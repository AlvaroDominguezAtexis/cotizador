export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user?: string;
}