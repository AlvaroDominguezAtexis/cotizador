import React, { ReactNode } from 'react';
import { ModalProps } from '../../types/common';
import { Button } from '../ui/Button';
import './Modal.css';

// Extendemos las props base del modal con opciones adicionales
interface ModalComponentProps extends ModalProps {
  title: string;
  children: ReactNode;
  size?: 'small' | 'medium' | 'large' | 'full';
  footer?: ReactNode;
  hideCloseButton?: boolean;
  variant?: 'default' | 'primary' | 'secondary';
}

const Modal: React.FC<ModalComponentProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  footer,
  hideCloseButton = false,
  variant = 'default'
}) => {
  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-container modal-${size} modal-${variant}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          {!hideCloseButton && (
            <button 
              className="modal-close-btn" 
              onClick={onClose}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          )}
        </div>

        <div className="modal-content">
          {children}
        </div>

        {(footer || variant !== 'default') && (
          <div className="modal-footer">
            {footer || (
              <Button 
                variant="secondary" 
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;