// src/components/profiles/ProfileTable.tsx
import React from 'react';
import { Profile } from '../../types/profile';
import { COUNTRIES } from '../../types/common';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import './ProfileTable.css';

interface ProfileTableProps {
  profiles: Profile[];
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (id: number) => void;
}

export const ProfileTable: React.FC<ProfileTableProps> = ({ 
  profiles, 
  onEditProfile, 
  onDeleteProfile 
}) => {
  // Generar columnas dinámicamente
  const columns = [
    {
      key: 'name',
      title: 'Nombre del Perfil',
      width: 200,
      render: (name: string, profile: Profile) => (
        <div className="profile-name-cell">
          <span>{name}</span>
        </div>
      )
    },
    // Columnas de salarios por país
    ...COUNTRIES.map(country => ({
      key: `salary-${country.code}`,
      title: `Salario ${country.name}`,
      width: 150,
      render: (value: any, profile: Profile) => (
        <div className="profile-salary-cell">
          <span>
            {profile.salaries[country.code] 
              ? `€${profile.salaries[country.code].toLocaleString()}` 
              : '-'}
          </span>
        </div>
      )
    })),
    {
      key: 'actions',
      title: 'Acciones',
      width: 150,
      render: (_: any, profile: Profile) => (
        <div className="profile-actions-cell">
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => onEditProfile(profile)}
          >
            Editar
          </Button>
          <Button 
            variant="danger" 
            size="sm"
            onClick={() => onDeleteProfile(profile.id)}
          >
            Eliminar
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="profile-table-container">
      <Table
        data={profiles}
        columns={columns}
        rowKey="id"
        title="Perfiles Profesionales"
        description="Listado de perfiles y sus salarios por país"
        bordered
        hoverable
      />
    </div>
  );
};

export default ProfileTable;