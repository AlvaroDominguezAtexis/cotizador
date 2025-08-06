// src/components/profiles/ProfilesManagement.tsx
import React, { useState } from 'react';
import Card from '../ui/Card';
import { Button } from '../ui/Button';
import EmptyState  from '../ui/EmptyState';
import { ProfilesList } from './ProfilesList';
import { ProfileForm } from './ProfileForm';
import { Profile } from '../../types/profile';
import { useProject } from '../../hooks/useProject';
import './ProfilesManagement.css';

export const ProfilesManagement: React.FC = () => {
  const { 
    profiles, 
    addProfile, 
    updateProfile, 
    deleteProfile 
  } = useProject();

  // Estados para gestión de vistas
  const [view, setView] = useState<'list' | 'import' | 'export'>('list');
  const [importedProfiles, setImportedProfiles] = useState<Profile[]>([]);

  // Manejar importación de perfiles
  const handleImportProfiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          // Validar estructura de perfiles
          const validProfiles = json.filter((profile: any) => 
            profile.name && typeof profile.name === 'string' && 
            profile.salaries && typeof profile.salaries === 'object'
          );
          setImportedProfiles(validProfiles);
        } catch (error) {
          alert('Error al importar perfiles. Formato de archivo inválido.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Manejar exportación de perfiles
  const handleExportProfiles = () => {
    const jsonProfiles = JSON.stringify(profiles, null, 2);
    const blob = new Blob([jsonProfiles], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perfiles_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Manejar importación de perfiles seleccionados
  const confirmImportProfiles = () => {
    importedProfiles.forEach(profile => {
      // Generar nuevo ID para evitar conflictos
      const profileToAdd: Profile = {
        ...profile,
        id: Date.now() + Math.random()
      };
      addProfile(profileToAdd);
    });
    setView('list');
    setImportedProfiles([]);
  };

  // Renderizado condicional de vistas
  const renderContent = () => {
    switch (view) {
      case 'list':
        return (
          <div className="profiles-management-container">
            <ProfilesList />
          </div>
        );
      
      case 'import':
        return (
          <Card>
            <div className="profiles-import-container">
              <h2>Importar Perfiles</h2>
              <input 
                type="file" 
                accept=".json"
                onChange={handleImportProfiles}
                className="profiles-import-input"
              />
              
              {importedProfiles.length > 0 && (
                <div className="profiles-import-preview">
                  <h3>Perfiles a Importar</h3>
                  <ul>
                    {importedProfiles.map((profile, index) => (
                      <li key={index}>
                        {profile.name} 
                        <span>
                          {Object.entries(profile.salaries)
                            .map(([country, salary]) => `${country}: €${salary}`)
                            .join(', ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="profiles-import-actions">
                    <Button 
                      variant="secondary"
                      onClick={() => {
                        setView('list');
                        setImportedProfiles([]);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      variant="primary"
                      onClick={confirmImportProfiles}
                    >
                      Confirmar Importación
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      
      default:
        return null;
    }
  };

  return renderContent();
};

export default ProfilesManagement;