export interface LoginCredentials {
  username: string; // Se usa como email
  password: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  user?: User;
}