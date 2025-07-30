import React, { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import './Input.css';

export type InputVariant = 'default' | 'success' | 'error' | 'warning';
export type InputSize = 'sm' | 'md' | 'lg';
export type InputType = 
  | 'text' 
  | 'password' 
  | 'email' 
  | 'number' 
  | 'date' 
  | 'search'
  | 'checkbox';

export interface BaseInputProps {
  /** Variante visual del input */
  variant?: InputVariant;
  /** Tamaño del input */
  size?: InputSize;
  /** Etiqueta del input */
  label?: string;
  /** Texto de ayuda */
  helpText?: string;
  /** Mensaje de error */
  error?: string;
  /** Si el input debe ocupar todo el ancho disponible */
  fullWidth?: boolean;
  /** Icono a mostrar antes del input */
  icon?: React.ReactNode;
  /** Icono a mostrar después del input */
  iconRight?: React.ReactNode;
  /** Función a ejecutar cuando se hace clic en el icono derecho */
  onIconRightClick?: () => void;
  /** Clases CSS adicionales */
  className?: string;
  /** Clases CSS adicionales para el contenedor */
  containerClassName?: string;
}

export interface TextInputProps extends BaseInputProps, 
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  type?: Exclude<InputType, 'checkbox'>;
}

export interface CheckboxProps extends BaseInputProps, 
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  type: 'checkbox';
}

export type InputProps = TextInputProps | CheckboxProps;

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  (props, ref) => {
    const {
      type = 'text',
      label,
      helpText,
      error,
      variant = 'default',
      size = 'md',
      fullWidth = false,
      icon,
      iconRight,
      onIconRightClick,
      className = '',
      containerClassName = '',
      ...rest
    } = props;

    // Renderizar checkbox
    if (type === 'checkbox') {
      return (
        <div className={`input-container ${fullWidth ? 'input-container-full-width' : ''} ${containerClassName}`}>
          <div className="checkbox-wrapper">
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              type="checkbox"
              className={`checkbox ${className}`}
              {...rest as InputHTMLAttributes<HTMLInputElement>}
            />
            {label && <label className="checkbox-label">{label}</label>}
          </div>
          
          {(error || helpText) && (
            <div className={`input-footer ${error ? 'input-error' : 'input-help'}`}>
              {error || helpText}
            </div>
          )}
        </div>
      );
    }

    // Renderizar input de texto
    return (
      <div className={`input-container ${fullWidth ? 'input-container-full-width' : ''} ${containerClassName}`}>
        {label && <label className="input-label">{label}</label>}
        
        <div className={`input-wrapper input-wrapper-${size} input-wrapper-${variant}`}>
          {icon && <div className="input-icon input-icon-left">{icon}</div>}
          
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
            className={`input input-${size} ${className}`}
            {...rest as InputHTMLAttributes<HTMLInputElement>}
          />
          
          {iconRight && (
            <button 
              type="button" 
              className="input-icon input-icon-right input-icon-clickable"
              onClick={onIconRightClick}
            >
              {iconRight}
            </button>
          )}
        </div>
        
        {(error || helpText) && (
          <div className={`input-footer ${error ? 'input-error' : 'input-help'}`}>
            {error || helpText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;