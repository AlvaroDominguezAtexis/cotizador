import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useOfficialProfiles } from '../../hooks/useOfficialProfiles';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';

import { Profile } from '../../types/profile';
// import { COUNTRIES } from '../../types/common';
import './Profiles.css';
import { useEffect as useLayoutEffect } from 'react';
// Hook para obtener salarios oficiales por perfil y país
function useOfficialProfileSalaries() {
  const [salaries, setSalaries] = useState<{ [profileId: string]: { [countryId: string]: number } }>({});
  useEffect(() => {
    fetch('/officialprofile-salaries')
      .then(res => res.json())
      .then((data: Array<{ profile_id: string | number; country_id: string | number; salary: number }>) => {
        const map: { [profileId: string]: { [countryId: string]: number } } = {};
        data.forEach(row => {
          const pid = String(row.profile_id);
          const cid = String(row.country_id);
          if (!map[pid]) map[pid] = {};
          map[pid][cid] = row.salary;
        });
        setSalaries(map);
      });
  }, []);
  return salaries;
}

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
  // Ref para saber si se hizo click en sugerencia o en "Añadir nuevo"
  const clickedRef = useRef(false);
  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
      // Si el valor no existe y no se hizo click en sugerencia ni en "Añadir nuevo", limpiar
      if (!exists && !clickedRef.current) {
        onChange('');
      }
      clickedRef.current = false;
    }, 200);
  };
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
        onBlur={handleBlur}
      />
      {showSuggestions && value && ReactDOM.createPortal(
        <div style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, background: '#fff', border: '1px solid #b6c6e3', borderRadius: 6, zIndex: 2000, boxShadow: '0 6px 24px 4px rgba(25, 118, 210, 0.18)' }}>
          {filteredProfiles.length > 0 ? (
            filteredProfiles.map(p => (
              <div
                key={p.id}
                style={{ padding: '7px 12px', cursor: 'pointer', color: '#1976d2' }}
                onMouseDown={() => {
                  clickedRef.current = true;
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
              onMouseDown={() => {
                clickedRef.current = true;
                onChange(value);
                setShowSuggestions(false);
              }}
            >
              <b>{value}</b>
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
  projectId: number;
}

export const ProfilesManagement: React.FC<ProfilesManagementProps> = ({ profiles, onChange, countries = [], loadingCountries = false, projectId }) => {
  const { profiles: officialProfiles, loading: loadingProfiles } = useOfficialProfiles();
  const officialSalaries = useOfficialProfileSalaries();
  const [nameInput, setNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [tableData, setTableData] = useState<Profile[]>(profiles);

  // Sincroniza tableData con profiles cuando cambian desde el padre
  useEffect(() => {
    setTableData(profiles);
  }, [profiles]);

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
        const officialProfile = officialProfiles.find(p => p.name === value);
        if (officialProfile) {
          // Fetch salarios oficiales dinámicamente
          fetch(`/project-profiles/${officialProfile.id}/salaries`)
            .then(res => res.json())
            .then((data: Array<{ country_id: string | number; salary: number }>) => {
              setEditingProfile(current => {
                if (!current) return null;
                // Mapear salarios por país
                const salaries: { [countryId: string]: number } = {};
                data.forEach(row => {
                  salaries[String(row.country_id)] = row.salary;
                });
                return {
                  ...current,
                  name: value,
                  is_official: true,
                  salaries
                };
              });
            });
          return {
            ...prev,
            name: value,
            is_official: true
          };
        }
        return {
          ...prev,
          name: value,
          is_official: false
        };
      }
      return {
        ...prev,
        salaries: { ...prev.salaries, [field]: Number(value) || 0 }
      };
    });
  }, [officialProfiles]);

  // Guardar nuevo perfil en la BBDD si no existe y devolver el id
  const saveNewProfileToDB = async (name: string) => {
    try {
      const res = await fetch('/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_official: false })
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'No se pudo guardar el perfil');
      }
      const data = await res.json();
      return data.id;
    } catch (e) {
      alert('Error guardando perfil: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  };

  // Asociar perfil a proyecto
  const addProfileToProject = async (projectId: number, profileId: number) => {
    try {
      await fetch('/project-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, profile_id: profileId })
      });
    } catch (e) {
      // Manejar error
    }
  };
  // Guardar perfil (nuevo o editado)
  const handleSaveProfile = useCallback(async () => {
    if (!editingProfile || !editingProfile.name?.trim()) {
      alert('El nombre del perfil es obligatorio');
      return;
    }

    let updated: Profile[] = tableData;
    const originalProfile = tableData.find(p => p.id === editingProfile.id);
    const isEdit = !!originalProfile;

    if (isEdit && originalProfile?.is_official) {
      // EDICIÓN de perfil oficial: eliminar asociación, crear nuevo perfil y asociar
      try {
        await fetch('/project-profiles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId, profile_id: originalProfile.id })
        });
      } catch (e) {}
      const profileId = await saveNewProfileToDB(editingProfile.name!);
      if (profileId) {
        await addProfileToProject(projectId, profileId);
        const newProfile: Profile = { ...editingProfile, id: profileId, is_official: false } as Profile;
        updated = tableData.map(p =>
          p.id === editingProfile.id ? newProfile : p
        );
      }
    } else if (isEdit && originalProfile && !originalProfile.is_official) {
      // EDICIÓN de perfil no oficial: actualizar perfil existente
      try {
        await fetch(`/profiles/${editingProfile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingProfile.name })
        });
      } catch (e) {}
      updated = tableData.map(profile =>
        profile.id === editingProfile.id ? { ...profile, name: editingProfile.name! } : profile
      );
    } else {
      // CREACIÓN: mismo flujo que antes
      const officialProfile = officialProfiles.find(p => p.name === editingProfile.name);
      if (officialProfile) {
        await addProfileToProject(projectId, Number(officialProfile.id));
        if (!tableData.some(p => p.id === Number(officialProfile.id))) {
          const newProfile: Profile = {
            ...editingProfile,
            id: Number(officialProfile.id),
            is_official: true
          } as Profile;
          updated = [...tableData, newProfile];
        }
      } else {
        const profileId = await saveNewProfileToDB(editingProfile.name!);
        if (profileId) {
          await addProfileToProject(projectId, profileId);
          const newProfile: Profile = { ...editingProfile, id: profileId, is_official: false } as Profile;
          updated = tableData.map(p =>
            p.id === editingProfile.id ? newProfile : p
          );
        }
      }
    }

    setTableData(updated);
    onChange(updated);
    setEditingProfile(null);
  }, [editingProfile, tableData, onChange, officialProfiles, projectId]);

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
                onAddNew={() => Promise.resolve()} // noop
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
                onClick={async () => {
                  // 1. Eliminar relación perfil-proyecto
                  try {
                    await fetch('/project-profiles', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: projectId, profile_id: profile.id })
                    });
                  } catch (e) {
                    // Manejar error si se desea
                  }
                  // 2. Si el perfil no es oficial, eliminarlo de la tabla perfiles
                  if (!profile.is_official) {
                    try {
                      await fetch(`/profiles/${profile.id}`, {
                        method: 'DELETE'
                      });
                    } catch (e) {
                      // Manejar error si se desea
                    }
                  }
                  // 3. Actualizar tabla local
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

