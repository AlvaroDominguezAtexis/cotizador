import React, { 
  forwardRef, 
  SelectHTMLAttributes, 
  ReactNode 
} from 'react';
import './Select.css';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options: SelectOption[];
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outlined' | 'filled';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  error,
  helperText,
  fullWidth = false,
  size = 'medium',
  variant = 'default',
  leftIcon,
  rightIcon,
  className = '',
  placeholder,
  ...props
}, ref) => {
  const selectClasses = [
    'custom-select',
    `custom-select-${size}`,
    `custom-select-${variant}`,
    fullWidth ? 'custom-select-full-width' : '',
    error ? 'custom-select-error' : '',
    leftIcon ? 'custom-select-with-left-icon' : '',
    rightIcon ? 'custom-select-with-right-icon' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="select-wrapper">
      {label && <label className="select-label">{label}</label>}
      <div className="select-container">
        {leftIcon && <div className="select-left-icon">{leftIcon}</div>}
        <select 
          ref={ref}
          className={selectClasses}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        {rightIcon && <div className="select-right-icon">{rightIcon}</div>}
      </div>
      {(error || helperText) && (
        <div className={`select-helper-text ${error ? 'select-error-text' : ''}`}>
          {error || helperText}
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;