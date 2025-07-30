import React, { ReactNode } from 'react';
import './EmptyState.css';

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'minimal' | 'illustrated';
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className = ''
}) => {
  const emptyStateClasses = [
    'empty-state',
    `empty-state-${variant}`,
    className
  ].filter(Boolean).join(' ');

  // Default icons based on variant
  const defaultIcons = {
    default: (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        className="empty-state-default-icon"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    minimal: (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        className="empty-state-minimal-icon"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    illustrated: (
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        className="empty-state-illustrated-icon"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="13" x2="12" y2="17" />
        <line x1="12" y1="13" x2="12" y2="17" />
      </svg>
    )
  };

  return (
    <div className={emptyStateClasses}>
      <div className="empty-state-content">
        {icon || defaultIcons[variant]}
        
        {title && (
          <h3 className="empty-state-title">
            {title}
          </h3>
        )}
        
        {description && (
          <p className="empty-state-description">
            {description}
          </p>
        )}
        
        {action && (
          <div className="empty-state-action">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;