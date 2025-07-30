// src/components/ui/Input.tsx
import React, { 
  InputHTMLAttributes, 
  TextareaHTMLAttributes, 
  SelectHTMLAttributes,
  forwardRef 
} from 'react';
import './Input.css';

export type InputType = 
  | 'text' 
  | 'password' 
  | 'email' 
  | 'number' 
  | 'date' 
  | 'search'
  | 'checkbox'
  | 'select'
  | 'textarea';

// Interfaz para opciones de select
export interface SelectOption {
  value: string | number;
  label: string;
}

export interface BaseInputProps {
  /** Variante visual del input */
  variant?: 'default' | 'success' | 'error' | 'warning';
  /** Tamaño del input */
  inputSize?: 'sm' | 'md' | 'lg';
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
  /** Tipo de input */
  type?: InputType;
}

export interface SelectProps extends 
  BaseInputProps, 
  Omit<SelectHTMLAttributes<HTMLSelectElement>, keyof BaseInputProps | 'size'> {
  type: 'select';
  options: SelectOption[];
}

export interface TextInputProps extends 
  BaseInputProps, 
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof BaseInputProps | 'size'> {
  type?: Exclude<InputType, 'select' | 'checkbox' | 'textarea'>;
}

export interface CheckboxProps extends 
  BaseInputProps, 
  Omit<InputHTMLAttributes<HTMLInputElement>, keyof BaseInputProps | 'size'> {
  type: 'checkbox';
}

export interface TextareaProps extends 
  BaseInputProps, 
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, keyof BaseInputProps | 'size'> {
  type: 'textarea';
}

export type InputProps = TextInputProps | CheckboxProps | SelectProps | TextareaProps;

export const Input = forwardRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, InputProps>(
  (props, ref) => {
    const {
      type = 'text',
      label,
      helpText,
      error,
      variant = 'default',
      inputSize = 'md',
      fullWidth = false,
      icon,
      iconRight,
      onIconRightClick,
      className = '',
      containerClassName = '',
      ...rest
    } = props;

    // Renderizar textarea
    if (type === 'textarea') {
      return (
        <div className={`input-container ${fullWidth ? 'input-container-full-width' : ''} ${containerClassName}`}>
          {label && <label className="input-label">{label}</label>}
          
          <div className={`input-wrapper input-wrapper-${inputSize} input-wrapper-${variant}`}>
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              className={`input input-${inputSize} ${className}`}
              {...rest as TextareaHTMLAttributes<HTMLTextAreaElement>}
            />
          </div>
          
          {(error || helpText) && (
            <div className={`input-footer ${error ? 'input-error' : 'input-help'}`}>
              {error || helpText}
            </div>
          )}
        </div>
      );
    }

    // Renderizar select
    if (type === 'select') {
      const { options, ...selectProps } = rest as SelectProps;
      return (
        <div className={`input-container ${fullWidth ? 'input-container-full-width' : ''} ${containerClassName}`}>
          {label && <label className="input-label">{label}</label>}
          
          <div className={`input-wrapper input-wrapper-${inputSize} input-wrapper-${variant}`}>
            <select
              ref={ref as React.Ref<HTMLSelectElement>}
              className={`input input-${inputSize} ${className}`}
              {...selectProps}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          {(error || helpText) && (
            <div className={`input-footer ${error ? 'input-error' : 'input-help'}`}>
              {error || helpText}
            </div>
          )}
        </div>
      );
    }

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
        
        <div className={`input-wrapper input-wrapper-${inputSize} input-wrapper-${variant}`}>
          {icon && <div className="input-icon input-icon-left">{icon}</div>}
          
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
            className={`input input-${inputSize} ${className}`}
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