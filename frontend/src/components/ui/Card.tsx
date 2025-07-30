import React, { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
}

const Card: React.FC<CardProps> = ({
  children, 
  className = '', 
  variant = 'default',
  onClick,
  header,
  footer
}) => {
  const cardClasses = [
    'card', 
    `card-${variant}`, 
    className,
    onClick ? 'card-clickable' : ''
  ].join(' ');

  return (
    <div 
      className={cardClasses} 
      onClick={onClick}
    >
      {header && <div className="card-header">{header}</div>}
      <div className="card-content">
        {children}
      </div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
};

export default Card;