import React, { useState, useCallback } from 'react';
import { ModalProps } from '../../types/common';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useModal } from '../../hooks/useModal';
import './AddActivityModal.css';

interface AddActivityModalProps extends ModalProps {
  onAddActivity: (activity: string) => string | null;
}

const AddActivityModal: React.FC<AddActivityModalProps> = ({ 
  isOpen, 
  onClose, 
  onAddActivity 
}) => {
  const { closeModal } = useModal();
  const [newActivity, setNewActivity] = useState('');
  const [error, setError] = useState('');

  // Método de cierre unificado
  const handleClose = useCallback(() => {
    console.log('Cerrando modal de actividad'); // Depuración
    
    // Limpiar estados
    setNewActivity('');
    setError('');
    
    // Cerrar modal
    closeModal('addActivity');
    
    // Llamar al callback de cierre si existe
    if (onClose) {
      onClose();
    }
  }, [closeModal, onClose]);

  const handleAddActivity = () => {
    // Validar que la actividad no esté vacía
    const trimmedActivity = newActivity.trim();
    
    if (!trimmedActivity) {
      setError('El nombre de la actividad no puede estar vacío');
      return;
    }

    // Validar longitud
    if (trimmedActivity.length < 3) {
      setError('La actividad debe tener al menos 3 caracteres');
      return;
    }

    // Añadir actividad
    const result = onAddActivity(trimmedActivity);
    
    if (result) {
      // Limpiar estados y cerrar modal
      handleClose();
    } else {
      setError('La actividad ya existe');
    }
  };

  // Si el modal no está abierto, no renderizar nada
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <h3>Añadir Nueva Actividad</h3>
          <button 
            className="modal-close-btn" 
            onClick={handleClose} // Usar el método de cierre unificado
          >
            ✕
          </button>
        </div>

        <div className="modal-content">
          <Input 
            label="Nombre de la Actividad"
            value={newActivity}
            onChange={(e) => {
              setNewActivity(e.target.value);
              setError('');
            }}
            placeholder="Ej: Desarrollo Web, Consultoría IT..."
            error={error}
          />
        </div>

        <div className="modal-footer">
          <Button 
            variant="secondary" 
            onClick={handleClose} // Usar el método de cierre unificado
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddActivity}
          >
            Añadir Actividad
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddActivityModal;