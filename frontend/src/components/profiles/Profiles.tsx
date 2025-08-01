import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useOfficialProfiles } from '../../hooks/useOfficialProfiles';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';

import { Profile } from '../../types/profile';
// import { COUNTRIES } from '../../types/common';
import './Profiles.css';
// Autocomplete input para nombre de perfil
const ProfileNameAutocomplete: React.FC<{
  value: string;
  officialProfiles: { id: string; name: string }[];
  onChange: (name: string) => void;
  onAddNew: (name: string) => Promise<void>;
}> = ({ value, officialProfiles, onChange, onAddNew }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const filteredProfiles = officialProfiles.filter(p => p.name.toLowerCase().includes(value.toLowerCase()));
  const exists = officialProfiles.some(p => p.name === value);
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [showSuggestions]);
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        ref={inputRef}
        type="text"
        className="profile-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Nombre del perfil"
        autoComplete="off"
        style={{ minWidth: 160 }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      {showSuggestions && value && ReactDOM.createPortal(
        <div style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, background: '#fff', border: '1px solid #b6c6e3', borderRadius: 6, zIndex: 2000, boxShadow: '0 6px 24px 4px rgba(25, 118, 210, 0.18)' }}>
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map(p => (
              <div
                key={p.id}
                style={{ padding: '7px 12px', cursor: 'pointer', color: '#1976d2' }}
                onMouseDown={() => {
                  onChange(p.name);
                  setShowSuggestions(false);
                }}
              >
                {p.name}
              </div>
            ))
          ) : (
            <div style={{ padding: '7px 12px', color: '#888' }}>
              No hay coincidencias
            </div>
          )}
          {value && !exists && (
            <div
              style={{ padding: '7px 12px', cursor: 'pointer', color: '#388e3c', fontWeight: 500 }}
              onMouseDown={async () => {
                await onAddNew(value);
                onChange(value);
                setShowSuggestions(false);
              }}
            >
              Añadir nuevo perfil: <b>{value}</b>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

interface ProfilesManagementProps {
  profiles: Profile[];
  onChange: (profiles: Profile[]) => void;
  countries?: { id: string; name: string }[];
  loadingCountries?: boolean;
}

export const ProfilesManagement: React.FC<ProfilesManagementProps> = ({ profiles, onChange, countries = [], loadingCountries = false }) => {
  const { profiles: officialProfiles, loading: loadingProfiles } = useOfficialProfiles();
  const [nameInput, setNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [tableData, setTableData] = useState<Profile[]>(profiles);

  // Añadir nueva fila editable
  const handleAddNewProfile = useCallback(() => {
    const newProfile: Profile = {
      id: Date.now(),
      name: '',
      salaries: {}
    };
    setNameInput('');
    setShowSuggestions(false);
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
      if (field === 'name') {
        setNameInput(value);
        setShowSuggestions(true);
      }
      return {
        ...prev,
        ...(field === 'name'
          ? { name: value }
          : { salaries: { ...prev.salaries, [field]: Number(value) || 0 } })
      };
    });
  }, []);

  // Guardar nuevo perfil en la BBDD si no existe
  const saveNewProfileToDB = async (name: string) => {
    try {
      const res = await fetch('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_official: false })
      });
      if (!res.ok) throw new Error('No se pudo guardar el perfil');
      // Opcional: recargar lista oficial
    } catch (e) {
      // Manejar error
    }
  };

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
            const value = editingProfile.name || '';
            return (
              <ProfileNameAutocomplete
                value={value}
                officialProfiles={officialProfiles}
                onChange={v => handleProfileChange('name', v)}
                onAddNew={saveNewProfileToDB}
              />
            );
          }
          return profile.name;
        }
      },
      ...countries.map(country => ({
        key: `salary-${country.id}`,
        title: `Salario ${country.name}`,
        render: (_: any, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            return (
              <input
                type="number"
                value={editingProfile.salaries?.[country.id] || ''}
                onChange={e => handleProfileChange(country.id, e.target.value)}
                placeholder={`Salario ${country.name}`}
                className="profile-input salary-input"
              />
            );
          }
          return profile.salaries[country.id]
            ? `€${profile.salaries[country.id].toLocaleString()}`
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
      countries
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

