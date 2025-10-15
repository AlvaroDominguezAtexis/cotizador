import React, { useState, FormEvent, KeyboardEvent } from 'react';
import { LoginCredentials } from '../../types/auth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import './LoginForm.css';

interface LoginFormProps {
  onLogin: (credentials: LoginCredentials) => Promise<boolean>;
  isLoading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onLogin, 
  isLoading = false 
}) => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    if (isSubmitting || isLoading) return;

    // Validación básica
    if (!credentials.username.trim()) {
      setError('El usuario es requerido');
      return;
    }

    if (!credentials.password.trim()) {
      setError('La contraseña es requerida');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const success = await onLogin(credentials);
      
      if (!success) {
        setError('Usuario o contraseña incorrectos');
        // Limpiar campos después de error
        setCredentials({
          username: '',
          password: ''
        });
      }
    } catch (err) {
      setError('Error de conexión. Inténtelo de nuevo.');
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LoginCredentials) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCredentials(prev => ({
      ...prev,
      [field]: event.target.value
    }));
    
    // Limpiar error al empezar a escribir
    if (error) {
      setError('');
    }
  };

  const handleKeyPress = (
    event: KeyboardEvent<HTMLInputElement>,
    nextFieldRef?: React.RefObject<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      if (nextFieldRef?.current) {
        nextFieldRef.current.focus();
      } else {
        // Si es el último campo, enviar formulario
        const form = event.currentTarget.closest('form');
        form?.requestSubmit();
      }
    }
  };

  const isFormDisabled = isSubmitting || isLoading;

  return (
    <div className="login-overlay">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-title">QS Tool</h1>
          <p className="login-subtitle">Enter your credentials to access</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <Input
              type="text"
              id="username"
              name="username"
              placeholder="Usuario"
              value={credentials.username}
              onChange={handleInputChange('username')}
              onKeyPress={(e) => handleKeyPress(e)}
              disabled={isFormDisabled}
              autoComplete="username"
              autoFocus
              required
              className="login-input"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          <div className="form-group">
            <Input
              type="password"
              id="password"
              name="password"
              placeholder="Contraseña"
              value={credentials.password}
              onChange={handleInputChange('password')}
              onKeyPress={(e) => handleKeyPress(e)}
              disabled={isFormDisabled}
              autoComplete="current-password"
              required
              className="login-input"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isFormDisabled}
            isLoading={isSubmitting || isLoading}
            className="login-btn"
            fullWidth
          >
            {isSubmitting || isLoading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </Button>

          {error && (
            <div 
              className="login-error" 
              id="login-error"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}
        </form>

        <div className="login-footer">
          <p className="login-demo-info">
          </p>
        </div>
      </div>
    </div>
  );
};

// Hook personalizado para usar con el LoginForm
export const useLoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simular llamada a API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Validación mock (en producción sería una llamada real a la API)
      const isValid = credentials.username === 'admin' && credentials.password === 'admin';
      
      if (isValid) {
        // Guardar token o estado de autenticación
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('user', credentials.username);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error during login:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleLogin,
    isLoading
  };
};