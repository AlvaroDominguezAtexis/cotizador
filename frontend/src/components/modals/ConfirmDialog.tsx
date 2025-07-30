import React from 'react';
import { ModalProps } from '../../types/common';
import { Button } from '../ui/Button';
import './ConfirmDialog.css';

interface ConfirmDialogProps extends ModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'danger' | 'warning';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default'
}) => {
  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container confirm-dialog">
        <div className="modal-header">
          <h3>{title}</h3>
          <button 
            className="modal-close-btn" 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <p>{message}</p>
        </div>

        <div className="modal-footer">
          <Button 
            variant="secondary" 
            onClick={onClose}
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;