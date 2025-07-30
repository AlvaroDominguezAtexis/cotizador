import React, { useEffect, useState } from 'react';
import { LoginForm, useLoginForm } from './LoginForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { AppError, UserSession } from '../../types/common';
import './AuthGuard.css';

interface AuthGuardProps {
  /** Contenido a proteger */
  children: React.ReactNode;
  /** Callback cuando el usuario se autentica exitosamente */
  onAuthenticated?: (user: UserSession) => void;
  /** Callback cuando el usuario cierra sesión */
  onLogout?: () => void;
  /** Roles requeridos para acceder (opcional) */
  requiredRoles?: string[];
  /** Permisos requeridos para acceder (opcional) */
  requiredPermissions?: string[];
  /** Mensaje personalizado para acceso denegado */
  accessDeniedMessage?: string;
  /** Redirección personalizada para usuarios no autenticados */
  redirectTo?: string;
  /** Modo de autenticación (estricto bloquea la aplicación hasta autenticar) */
  mode?: 'strict' | 'lazy';
}

// Hook para gestionar el estado de autenticación
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<AppError | null>(null);

  // Verificar autenticación al cargar
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar si hay una sesión guardada
      const savedSession = localStorage.getItem('userSession');
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

      if (isLoggedIn && savedSession) {
        const session: UserSession = JSON.parse(savedSession);
        
        // Verificar si la sesión no ha expirado (opcional)
        const sessionAge = Date.now() - new Date(session.lastActivity).getTime();
        const maxSessionAge = 24 * 60 * 60 * 1000; // 24 horas

        if (sessionAge < maxSessionAge) {
          // Actualizar última actividad
          session.lastActivity = new Date();
          localStorage.setItem('userSession', JSON.stringify(session));
          
          setUser(session);
          setIsAuthenticated(true);
        } else {
          // Sesión expirada
          await logout();
          setError({
            code: 'SESSION_EXPIRED',
            message: 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.',
            timestamp: new Date()
          });
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (err) {
      console.error('Error checking auth status:', err);
      setError({
        code: 'AUTH_CHECK_ERROR',
        message: 'Error al verificar el estado de autenticación',
        details: err,
        timestamp: new Date()
      });
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Simular llamada a API de autenticación
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Validación mock (en producción sería una llamada real a la API)
      if (username === 'admin' && password === 'admin') {
        const userSession: UserSession = {
          user: username,
          loginTime: new Date(),
          lastActivity: new Date(),
          permissions: ['read', 'write', 'admin'] // Permisos de ejemplo
        };

        // Guardar sesión
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userSession', JSON.stringify(userSession));

        setUser(userSession);
        setIsAuthenticated(true);
        return true;
      } else {
        setError({
          code: 'INVALID_CREDENTIALS',
          message: 'Usuario o contraseña incorrectos',
          timestamp: new Date()
        });
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      setError({
        code: 'LOGIN_ERROR',
        message: 'Error durante el inicio de sesión',
        details: err,
        timestamp: new Date()
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      
      // Limpiar almacenamiento local
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userSession');
      
      // En producción, aquí llamarías a la API para invalidar la sesión
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setUser(null);
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      console.error('Logout error:', err);
      // Aunque falle el logout en el servidor, limpiamos localmente
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const updateLastActivity = () => {
    if (user) {
      const updatedUser = {
        ...user,
        lastActivity: new Date()
      };
      setUser(updatedUser);
      localStorage.setItem('userSession', JSON.stringify(updatedUser));
    }
  };

  const hasRole = (role: string): boolean => {
    return user?.permissions?.includes(role) || false;
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasAnyRole = (roles: string[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    checkAuthStatus,
    updateLastActivity,
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllPermissions
  };
};

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  onAuthenticated,
  onLogout,
  requiredRoles = [],
  requiredPermissions = [],
  accessDeniedMessage = 'No tiene permisos para acceder a esta sección',
  mode = 'strict'
}) => {
  const {
    isAuthenticated,
    user,
    isLoading,
    error,
    login,
    logout,
    updateLastActivity,
    hasAnyRole,
    hasAllPermissions
  } = useAuth();

  const { handleLogin, isLoading: loginLoading } = useLoginForm();

  // Actualizar actividad del usuario periódicamente
  useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(updateLastActivity, 5 * 60 * 1000); // cada 5 minutos
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, updateLastActivity]);

  // Notificar cuando el usuario se autentica
  useEffect(() => {
    if (isAuthenticated && user && onAuthenticated) {
      onAuthenticated(user);
    }
  }, [isAuthenticated, user, onAuthenticated]);

  // Manejar logout
  const handleLogout = async () => {
    await logout();
    if (onLogout) {
      onLogout();
    }
  };

  // Manejar login
  const handleLoginSubmit = async (credentials: { username: string; password: string }): Promise<boolean> => {
    const success = await login(credentials.username, credentials.password);
    return success;
  };

  // Verificar permisos
  const hasRequiredAccess = (): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Verificar roles requeridos
    if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
      return false;
    }
    
    // Verificar permisos requeridos
    if (requiredPermissions.length > 0 && !hasAllPermissions(requiredPermissions)) {
      return false;
    }
    
    return true;
  };

  // Pantalla de carga
  if (isLoading) {
    return (
      <div className="auth-guard-loading">
        <LoadingSpinner size="large" />
        <p className="auth-guard-loading-text">Verificando autenticación...</p>
      </div>
    );
  }

  // No autenticado - mostrar login
  if (!isAuthenticated) {
    return (
      <div className="auth-guard-login">
        <LoginForm
          onLogin={handleLoginSubmit}
          isLoading={loginLoading}
        />
        {error && (
          <div className="auth-guard-error">
            <div className="auth-guard-error-content">
              <h3>Error de Autenticación</h3>
              <p>{error.message}</p>
              {error.code === 'SESSION_EXPIRED' && (
                <button 
                  className="auth-guard-retry-btn"
                  onClick={() => window.location.reload()}
                >
                  Recargar Página
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Autenticado pero sin permisos suficientes
  if (!hasRequiredAccess()) {
    return (
      <div className="auth-guard-access-denied">
        <div className="auth-guard-access-denied-content">
          <div className="auth-guard-access-denied-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          
          <h2 className="auth-guard-access-denied-title">Acceso Denegado</h2>
          <p className="auth-guard-access-denied-message">{accessDeniedMessage}</p>
          
          <div className="auth-guard-access-denied-details">
            {requiredRoles.length > 0 && (
              <p><strong>Roles requeridos:</strong> {requiredRoles.join(', ')}</p>
            )}
            {requiredPermissions.length > 0 && (
              <p><strong>Permisos requeridos:</strong> {requiredPermissions.join(', ')}</p>
            )}
            <p><strong>Su usuario:</strong> {user?.user}</p>
            <p><strong>Sus permisos:</strong> {user?.permissions?.join(', ') || 'Ninguno'}</p>
          </div>
          
          <div className="auth-guard-access-denied-actions">
            <button 
              className="btn btn-secondary"
              onClick={() => window.history.back()}
            >
              Volver Atrás
            </button>
            <button 
              className="btn btn-danger"
              onClick={handleLogout}
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Todo OK - mostrar contenido protegido
  return (
    <div className="auth-guard-content">
      {children}
    </div>
  );
};

// Componente HOC para proteger componentes específicos
export const withAuthGuard = <P extends object>(
  Component: React.ComponentType<P>,
  guardProps?: Omit<AuthGuardProps, 'children'>
) => {
  return (props: P) => (
    <AuthGuard {...guardProps}>
      <Component {...props} />
    </AuthGuard>
  );
};

// Hook para usar el contexto de auth en componentes hijos
export const useAuthContext = () => {
  const auth = useAuth();
  
  if (!auth.isAuthenticated) {
    throw new Error('useAuthContext debe usarse dentro de un AuthGuard autenticado');
  }
  
  return auth;
};

export default AuthGuard;