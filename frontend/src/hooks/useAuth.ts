import { useState, useCallback, useEffect } from 'react';
import { LoginCredentials, AuthState, User } from '../types/auth';
import { apiConfig } from '../utils/apiConfig';

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    user: undefined
  });

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await apiConfig.fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setAuthState({
          isLoggedIn: true,
          user: data.user
        });
      } else if (response.status === 401) {
        // Normal cuando no hay sesión activa - no mostrar error
        setAuthState({
          isLoggedIn: false,
          user: undefined
        });
      }
    } catch (error) {
      // Silencioso - esto es normal al cargar la app sin sesión
      setAuthState({
        isLoggedIn: false,
        user: undefined
      });
    }
  };

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const response = await apiConfig.fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.username, // Using username field as email
          password: credentials.password
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAuthState({
          isLoggedIn: true,
          user: data.user
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiConfig.fetch('/api/auth/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAuthState({
        isLoggedIn: false,
        user: undefined
      });
    }
  }, []);

  return {
    ...authState,
    login,
    logout
  };
};