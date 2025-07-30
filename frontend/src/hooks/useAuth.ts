import { useState, useCallback } from 'react';
import { LoginCredentials, AuthState } from '../types/auth';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    user: undefined
  });

  const login = useCallback((credentials: LoginCredentials): boolean => {
    // Lógica de login simulada
    if (credentials.username === 'admin' && credentials.password === 'admin') {
      setAuthState({
        isLoggedIn: true,
        user: credentials.username
      });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setAuthState({
      isLoggedIn: false,
      user: undefined
    });
  }, []);

  return {
    ...authState,
    login,
    logout
  };
};