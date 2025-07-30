import React, { useState, useCallback, useMemo } from 'react';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';

import { Profile } from '../../types/profile';
import { COUNTRIES } from '../../types/common';
import './Profiles.css';

interface ProfilesManagementProps {
  profiles: Profile[];
  onChange: (profiles: Profile[]) => void;
}

export const ProfilesManagement: React.FC<ProfilesManagementProps> = ({ profiles, onChange }) => {
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [tableData, setTableData] = useState<Profile[]>(profiles);

  // Añadir nueva fila editable
  const handleAddNewProfile = useCallback(() => {
    const newProfile: Profile = {
      id: Date.now(),
      name: '',
      salaries: {}
    };
    const updated = [...tableData, newProfile];
    setTableData(updated);
    setEditingProfile(newProfile);
    onChange(updated);
  }, [tableData, onChange]);

  // Editar un perfil existente
  const handleEditProfile = useCallback((profile: Profile) => {
    // Creamos una copia para no mutar el estado original
    setEditingProfile({ ...profile, salaries: { ...profile.salaries } });
  }, []);

  // Actualizar perfil en edición
  const handleProfileChange = useCallback((field: string, value: string) => {
    setEditingProfile(prev => {
      if (!prev) return null;
      return {
        ...prev,
        ...(field === 'name'
          ? { name: value }
          : { salaries: { ...prev.salaries, [field]: Number(value) || 0 } })
      };
    });
  }, []);

  // Guardar perfil (nuevo o editado)
  const handleSaveProfile = useCallback(() => {
    if (!editingProfile || !editingProfile.name?.trim()) {
      alert('El nombre del perfil es obligatorio');
      return;
    }

    const exists = tableData.some(p => p.id === editingProfile.id);
    let updated: Profile[];
    if (!exists) {
      // Nuevo perfil
      updated = [...tableData, editingProfile as Profile];
    } else {
      // Perfil existente
      updated = tableData.map(profile =>
        profile.id === editingProfile.id ? (editingProfile as Profile) : profile
      );
    }
    setTableData(updated);
    onChange(updated);
    setEditingProfile(null);
  }, [editingProfile, tableData, onChange]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    // Si es nuevo y no se ha guardado, lo eliminamos
    let updated = tableData;
    if (tableData.some(p => p.id === editingProfile?.id && !p.name)) {
      updated = tableData.filter(profile => profile.id !== editingProfile?.id);
      setTableData(updated);
      onChange(updated);
    }
    setEditingProfile(null);
  }, [editingProfile, tableData, onChange]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'id',
        title: 'ID',
        render: (_: any, profile: Profile) =>
          editingProfile && editingProfile.id === profile.id
            ? 'Nuevo'
            : `P${profile.id}`
      },
      {
        key: 'name',
        title: 'Nombre del Perfil',
        render: (_: string, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            return (
              <input
                type="text"
                value={editingProfile.name || ''}
                onChange={e => handleProfileChange('name', e.target.value)}
                placeholder="Nombre del perfil"
                className="profile-input"
              />
            );
          }
          return profile.name;
        }
      },
      ...COUNTRIES.map(country => ({
        key: `salary-${country.code}`,
        title: `Salario ${country.name}`,
        render: (_: any, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            return (
              <input
                type="number"
                value={editingProfile.salaries?.[country.code] || ''}
                onChange={e => handleProfileChange(country.code, e.target.value)}
                placeholder={`Salario ${country.name}`}
                className="profile-input salary-input"
              />
            );
          }
          return profile.salaries[country.code]
            ? `€${profile.salaries[country.code].toLocaleString()}`
            : '-';
        }
      })),
      {
        key: 'actions',
        title: 'Acciones',
        render: (_: any, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            return (
              <div className="table-row-actions">
                <Button variant="success" size="sm" onClick={handleSaveProfile}>
                  Guardar
                </Button>
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
              </div>
            );
          }

          return (
            <div className="table-row-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEditProfile(profile)}
              >
                Editar
              </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const updated = tableData.filter(p => p.id !== profile.id);
              setTableData(updated);
              onChange(updated);
            }}
          >
            Eliminar
          </Button>
            </div>
          );
        }
      }
    ],
    [
      editingProfile,
      handleProfileChange,
      handleSaveProfile,
      handleCancelEdit,
      handleEditProfile,
    ]
  );

  // Botón de cabecera
  const headerActions = useMemo(
    () => (
      <Button variant="success" size="sm" onClick={handleAddNewProfile}>
        Añadir Perfil
      </Button>
    ),
    [handleAddNewProfile]
  );

  return (
    <Table
      data={tableData}
      columns={columns}
      rowKey="id"
      title="Project Profiles"
      description="Administrate the profiles participating in the project."
      headerActions={headerActions}
      bordered
      hoverable
      rowClassName={(profile) =>
        editingProfile && editingProfile.id === profile.id ? 'new-profile-row' : ''
      }
    />
  );
};

export default ProfilesManagement;

