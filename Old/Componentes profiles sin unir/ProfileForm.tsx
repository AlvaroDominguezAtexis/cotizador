// src/components/profiles/ProfileForm.tsx
import React, { useState, useEffect } from 'react';
import { Profile } from '../../types/profile';
import { COUNTRIES } from '../../types/common';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import './ProfileForm.css';

interface ProfileFormProps {
  initialProfile?: Profile | null;
  onSubmit: (profile: Profile) => void;
  onCancel: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ 
  initialProfile, 
  onSubmit, 
  onCancel 
}) => {
  // Estado del formulario
  const [name, setName] = useState(initialProfile?.name || '');
  const [salaries, setSalaries] = useState<Record<string, number>>(
    initialProfile?.salaries || {}
  );

  // Validación de formulario
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Validar formulario
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre del perfil es obligatorio';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const profileToSubmit: Profile = {
        id: initialProfile?.id || Date.now(),
        name,
        salaries
      };

      onSubmit(profileToSubmit);
    }
  };

  // Manejar cambio de salario por país
  const handleSalaryChange = (countryCode: string, value: string) => {
    const numericValue = value === '' ? 0 : Number(value);
    
    setSalaries(prev => ({
      ...prev,
      [countryCode]: numericValue
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="profile-form">
      <div className="profile-form-header">
        <h2>
          {initialProfile 
            ? 'Editar Perfil Profesional' 
            : 'Nuevo Perfil Profesional'}
        </h2>
      </div>

      <div className="profile-form-body">
        {/* Nombre del perfil */}
        <div className="profile-form-section">
          <Input
            label="Nombre del Perfil"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            placeholder="Ej: Desarrollador Senior, Diseñador UX"
            fullWidth
          />
        </div>

        {/* Salarios por país */}
        <div className="profile-form-section">
          <h3 className="profile-form-section-title">Salarios por País</h3>
          
          <div className="profile-salary-grid">
            {COUNTRIES.map(country => (
              <div key={country.code} className="profile-salary-item">
                <Input
                  label={country.name}
                  type="number"
                  value={salaries[country.code] || 0}
                  onChange={(e) => handleSalaryChange(country.code, e.target.value)}
                  placeholder="Salario base"
                  fullWidth
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones del formulario */}
      <div className="profile-form-actions">
        <Button 
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button 
          type="submit"
          variant="primary"
        >
          {initialProfile ? 'Actualizar Perfil' : 'Crear Perfil'}
        </Button>
      </div>
    </form>
  );
};

export default ProfileForm;