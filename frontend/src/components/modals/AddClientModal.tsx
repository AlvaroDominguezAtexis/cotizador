import React, { useState, useCallback } from 'react';
import { ModalProps } from '../../types/common';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useModal } from '../../hooks/useModal';
import './AddClientModal.css';

interface AddClientModalProps extends ModalProps {
  onAddClient: (client: string) => string | null;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddClient 
}) => {
  const { closeModal } = useModal();
  const [newClient, setNewClient] = useState('');
  const [error, setError] = useState('');

  // Método de cierre unificado
  const handleClose = useCallback(() => {
    console.log('Cerrando modal de cliente'); // Depuración
    
    // Limpiar estados
    setNewClient('');
    setError('');
    
    // Cerrar modal
    closeModal('addClient');
    
    // Llamar al callback de cierre si existe
    if (onClose) {
      onClose();
    }
  }, [closeModal, onClose]);

  const handleAddClient = () => {
    // Validar que el cliente no esté vacío
    const trimmedClient = newClient.trim();
    
    if (!trimmedClient) {
      setError('El nombre del cliente no puede estar vacío');
      return;
    }

    // Validar longitud
    if (trimmedClient.length < 2) {
      setError('El nombre del cliente debe tener al menos 2 caracteres');
      return;
    }

    // Validar caracteres
    const clientNameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    if (!clientNameRegex.test(trimmedClient)) {
      setError('El nombre del cliente solo puede contener letras');
      return;
    }

    // Añadir cliente
    const result = onAddClient(trimmedClient);
    
    if (result) {
      // Limpiar estados y cerrar modal
      handleClose();
    } else {
      setError('El cliente ya existe');
    }
  };

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>Añadir Nuevo Cliente</h3>
          <button 
            className="modal-close-btn" 
            onClick={handleClose} 
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <Input 
            label="Nombre del Cliente"
            value={newClient}
            onChange={(e) => {
              setNewClient(e.target.value);
              setError('');
            }}
            placeholder="Ej: Banco Santander, BBVA..."
            error={error}
          />
        </div>

        <div className="modal-footer">
          <Button 
            variant="secondary" 
            onClick={handleClose}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddClient}
          >
            Añadir Cliente
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddClientModal;