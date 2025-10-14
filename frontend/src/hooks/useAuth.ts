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
      const response = await fetch(apiConfig.url('/api/auth/me'), {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setAuthState({
          isLoggedIn: true,
          user: data.user
        });
      }
    } catch (error) {
      console.log('Not authenticated');
    }
  };

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      const response = await fetch(apiConfig.url('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      await fetch(apiConfig.url('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include'
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