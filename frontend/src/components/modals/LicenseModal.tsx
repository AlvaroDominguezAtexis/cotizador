import React, { useState, useEffect } from 'react';
import { ModalProps } from '../../types/common';
import { License } from '../../types/license';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import Modal from './Modal';
import './LicenseModal.css';

interface LicenseModalProps extends ModalProps {
  initialLicense?: License | null;
  onSave: (licenseData: Omit<License, 'id'>) => void;
}

const LICENSE_TYPES = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'service', label: 'Servicio' },
  { value: 'other', label: 'Otro' }
];

const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  initialLicense,
  onSave
}) => {
  const [formData, setFormData] = useState<Omit<License, 'id'>>({
    name: '',
    cost: 0,
    fullProjectCost: false,
    description: '',
    provider: '',
    type: 'software',
    renewalDate: '',
    licenseKey: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos de licencia existente al abrir el modal
  useEffect(() => {
    if (initialLicense) {
      setFormData({
        name: initialLicense.name,
        cost: initialLicense.cost,
        fullProjectCost: initialLicense.fullProjectCost,
        description: initialLicense.description || '',
        provider: initialLicense.provider || '',
        type: initialLicense.type || 'software',
        renewalDate: initialLicense.renewalDate || '',
        licenseKey: initialLicense.licenseKey || ''
      });
    } else {
      // Resetear formulario si es una nueva licencia
      setFormData({
        name: '',
        cost: 0,
        fullProjectCost: false,
        description: '',
        provider: '',
        type: 'software',
        renewalDate: '',
        licenseKey: ''
      });
    }
  }, [initialLicense]);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    // Manejar checkbox
    if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Limpiar errores
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Validar formulario
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre de la licencia es obligatorio';
    }

    if (formData.cost < 0) {
      newErrors.cost = 'El coste no puede ser negativo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Guardar licencia
  const handleSave = () => {
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialLicense ? 'Editar Licencia' : 'Nueva Licencia'}
      size="large"
      footer={(
        <>
          <Button 
            variant="secondary" 
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
          >
            Guardar Licencia
          </Button>
        </>
      )}
    >
      <div className="license-modal-grid">
        <Input 
          label="Nombre de la Licencia *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />

        <Input 
          type="number"
          label="Coste *"
          name="cost"
          value={formData.cost}
          onChange={handleChange}
          error={errors.cost}
          required
        />

        <Input 
          label="Proveedor"
          name="provider"
          value={formData.provider}
          onChange={handleChange}
        />

        <Input 
          type="date"
          label="Fecha de Renovación"
          name="renewalDate"
          value={formData.renewalDate}
          onChange={handleChange}
        />

        <Input 
          label="Clave de Licencia"
          name="licenseKey"
          value={formData.licenseKey}
          onChange={handleChange}
        />

        <div className="form-group">
          <label>Tipo de Licencia</label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="license-type-select"
          >
            {LICENSE_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group full-width">
          <Input 
            type="textarea"
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
          />
        </div>

        <div className="form-group checkbox-group">
          <label>
            <input 
              type="checkbox"
              name="fullProjectCost"
              checked={formData.fullProjectCost}
              onChange={handleChange}
            />
            Coste para Proyecto Completo
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default LicenseModal;