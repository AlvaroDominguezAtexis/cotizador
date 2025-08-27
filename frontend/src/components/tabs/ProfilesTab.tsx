// src/components/tabs/ProfilesTab.tsx


import React from 'react';
import { Button } from '../ui/Button';
import { ProfilesManagement } from '../profiles/Profiles';
import { ProjectManagerSalaries } from '../profiles/ProjectManagerSalaries';
import { useCountryNames } from '../../hooks/useCountryNames';
import './Tabs.css';


interface ProfilesTabProps {
  profiles: any[];
  onChange: (profiles: any[]) => void;
  additionalCountries?: string[]; // mantén el nombre del prop para no romper uso existente
  projectId: number;
}

export const ProfilesTab: React.FC<ProfilesTabProps> = ({ profiles, onChange, additionalCountries = [], projectId }) => {
  const { countries: countryList, loading: loadingCountries } = useCountryNames(additionalCountries);
  const handleExport = () => {
    const profilesData = JSON.stringify(profiles, null, 2);
    const blob = new Blob([profilesData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `perfiles_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedProfiles = JSON.parse(event.target?.result as string);
            onChange(importedProfiles);
          } catch (error) {
            alert('Error al importar perfiles. Formato de archivo inválido.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Gestión de perfiles</h1>
        <div className="tab-actions">
          <Button 
            variant="secondary"
            onClick={handleImport}
          >
            Importar Perfiles
          </Button>
          <Button 
            variant="primary"
            onClick={handleExport}
          >
            Exportar Perfiles
          </Button>
        </div>
      </div>

      <div className="tab-content">
        <ProfilesManagement
          profiles={profiles}
          onChange={onChange}
          countries={countryList}
          loadingCountries={loadingCountries}
          projectId={projectId}
        />
        {!loadingCountries && countryList.length > 0 && (
          <ProjectManagerSalaries
            projectId={projectId}
            countries={countryList}
          />
        )}
      </div>
    </div>
  );
};

export default ProfilesTab;