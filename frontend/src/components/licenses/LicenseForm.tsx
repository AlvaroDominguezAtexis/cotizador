import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { License } from '../../types/license';
import './LicenseForm.css';

// Tipos de licencia predefinidos
const LICENSE_TYPES = [
  { value: 'software', label: 'Software' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'service', label: 'Servicio' },
  { value: 'other', label: 'Otro' }
];

interface LicenseFormProps {
  initialLicense?: License | null;
  onSubmit: (licenseData: Omit<License, 'id'>) => void;
  onCancel?: () => void;
}

const LicenseForm: React.FC<LicenseFormProps> = ({ 
  initialLicense, 
  onSubmit, 
  onCancel 
}) => {
  // Estado inicial del formulario
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

  // Estado de errores
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Cargar datos de licencia existente
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
    }
  }, [initialLicense]);

  // Manejar cambios en los inputs
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

    // Limpiar errores para el campo actual
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

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="license-form">
      <div className="license-form-grid">
        {/* Nombre de la Licencia */}
        <Input 
          label="Nombre de la Licencia *"
          name="name"
          value={formData.name}
          onChange={handleChange}
          error={errors.name}
          required
        />

        {/* Coste */}
        <Input 
          type="number"
          label="Coste *"
          name="cost"
          value={formData.cost}
          onChange={handleChange}
          error={errors.cost}
          required
        />

        {/* Proveedor */}
        <Input 
          label="Proveedor"
          name="provider"
          value={formData.provider}
          onChange={handleChange}
        />

        {/* Fecha de Renovación */}
        <Input 
          type="date"
          label="Fecha de Renovación"
          name="renewalDate"
          value={formData.renewalDate}
          onChange={handleChange}
        />

        {/* Clave de Licencia */}
        <Input 
          label="Clave de Licencia"
          name="licenseKey"
          value={formData.licenseKey}
          onChange={handleChange}
        />

        {/* Tipo de Licencia */}
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

        {/* Descripción */}
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

        {/* Checkbox de Proyecto Completo */}
        <div className="form-group checkbox-group full-width">
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

      {/* Botones de acción */}
      <div className="license-form-actions">
        {onCancel && (
          <Button 
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancelar
          </Button>
        )}
        <Button 
          type="submit"
          variant="primary"
        >
          {initialLicense ? 'Actualizar Licencia' : 'Crear Licencia'}
        </Button>
      </div>
    </form>
  );
};

export default LicenseForm;