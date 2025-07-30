// src/components/profiles/ProfilesList.tsx
import React, { useState } from 'react';
import { useProject } from '../../hooks/useProject';
import { Profile } from '../../types/profile';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import Card  from '../ui/Card';
import EmptyState  from '../ui/EmptyState';
import { ProfileForm } from './ProfileForm';
import { ProfileTable } from './ProfileTable';
import './ProfilesList.css';

export const ProfilesList: React.FC = () => {
  const { profiles, addProfile, updateProfile, deleteProfile } = useProject();
  
  // Estados para gestión de formulario
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Manejar adición de nuevo perfil
  const handleAddProfile = (newProfile: Profile) => {
    console.log('Añadiendo perfil:', newProfile);
    addProfile(newProfile);
    console.log('Perfiles después de añadir:', profiles);
    setIsFormOpen(false);
    setEditingProfile(null);
  };

  // Manejar edición de perfil
  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setIsFormOpen(true);
  };

  // Renderizado condicional
  if (profiles.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay perfiles"
          description="Añade tu primer perfil profesional"
          action={
            <Button 
              variant="primary" 
              onClick={() => setIsFormOpen(true)}
            >
              Añadir Perfil
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <div className="profiles-list">
      <div className="profiles-list-header">
        <h2 className="profiles-list-title">Perfiles Profesionales</h2>
        <Button 
          variant="success" 
          onClick={() => {
            setEditingProfile(null);
            setIsFormOpen(true);
          }}
        >
          + Añadir Perfil
        </Button>
      </div>

      {/* Tabla de Perfiles */}
      <ProfileTable 
        profiles={profiles}
        onEditProfile={handleEditProfile}
        onDeleteProfile={deleteProfile}
      />

      {/* Formulario modal para añadir/editar perfil */}
      {isFormOpen && (
        <div className="profiles-list-form-overlay">
          <div className="profiles-list-form-container">
            <ProfileForm
              initialProfile={editingProfile}
              onSubmit={handleAddProfile}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingProfile(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilesList;