import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import './Button.css';

export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'success' 
  | 'danger' 
  | 'warning' 
  | 'info' 
  | 'light' 
  | 'dark' 
  | 'link' 
  | 'outline-primary' 
  | 'outline-secondary';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Variante visual del botón */
  variant?: ButtonVariant;
  /** Tamaño del botón */
  size?: ButtonSize;
  /** Si el botón debe ocupar todo el ancho disponible */
  fullWidth?: boolean;
  /** Estado de carga del botón */
  isLoading?: boolean;
  /** Texto a mostrar durante la carga */
  loadingText?: string;
  /** Icono a mostrar antes del texto */
  icon?: React.ReactNode;
  /** Icono a mostrar después del texto */
  iconRight?: React.ReactNode;
  /** Solo mostrar icono (sin texto) */
  iconOnly?: boolean;
  /** Clases CSS adicionales */
  className?: string;
  /** Children del botón */
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      loadingText,
      icon,
      iconRight,
      iconOnly = false,
      className = '',
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseClasses = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = `btn-${size}`;
    const fullWidthClass = fullWidth ? 'btn-full-width' : '';
    const loadingClass = isLoading ? 'btn-loading' : '';
    const iconOnlyClass = iconOnly ? 'btn-icon-only' : '';
    const disabledClass = (disabled || isLoading) ? 'btn-disabled' : '';

    const buttonClasses = [
      baseClasses,
      variantClass,
      sizeClass,
      fullWidthClass,
      loadingClass,
      iconOnlyClass,
      disabledClass,
      className
    ]
      .filter(Boolean)
      .join(' ');

    const isDisabled = disabled || isLoading;

    const renderContent = () => {
      if (isLoading) {
        return (
          <>
            <span className="btn-spinner" aria-hidden="true" />
            {loadingText || (iconOnly ? '' : 'Cargando...')}
          </>
        );
      }

      if (iconOnly && icon) {
        return icon;
      }

      return (
        <>
          {icon && <span className="btn-icon btn-icon-left">{icon}</span>}
          {children && <span className="btn-text">{children}</span>}
          {iconRight && <span className="btn-icon btn-icon-right">{iconRight}</span>}
        </>
      );
    };

    return (
      <button
        ref={ref}
        type={type}
        className={buttonClasses}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={isLoading}
        {...props}
      >
        {renderContent()}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Componentes específicos pre-configurados
export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="secondary" {...props} />
);

export const DangerButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="danger" {...props} />
);

export const SuccessButton: React.FC<Omit<ButtonProps, 'variant'>> = (props) => (
  <Button variant="success" {...props} />
);

export const IconButton: React.FC<Omit<ButtonProps, 'iconOnly'>> = (props) => (
  <Button iconOnly {...props} />
);

// Hook para manejar estados de botones con acciones async
export const useAsyncButton = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const executeAsync = React.useCallback(
    async (asyncFn: () => Promise<void>) => {
      try {
        setIsLoading(true);
        setError(null);
        await asyncFn();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = React.useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    executeAsync,
    reset
  };
};