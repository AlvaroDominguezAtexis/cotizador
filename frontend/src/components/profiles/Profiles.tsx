import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useOfficialProfiles } from '../../hooks/useOfficialProfiles';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';

import { Profile } from '../../types/profile';
// import { COUNTRIES } from '../../types/common';
import './Profiles.css';

interface ProfilesManagementProps {
  profiles: Profile[];
  onChange: (profiles: Profile[]) => void;
  countries?: { id: string; name: string }[];
  loadingCountries?: boolean;
  projectId: number;
}

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

export const ProfilesManagement: React.FC<ProfilesManagementProps> = ({ profiles, onChange, countries = [], loadingCountries = false, projectId }) => {
  const { profiles: officialProfiles, loading: loadingProfiles } = useOfficialProfiles();
  const officialSalaries = useOfficialProfileSalaries();
  const [nameInput, setNameInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [tableData, setTableData] = useState<Profile[]>(profiles);

  // Estado local de salarios por perfil
  const [projectProfileSalaries, setProjectProfileSalaries] = useState<{ [profileId: string]: { [countryId: string]: number } }>({});

  // Helper para recargar salarios desde el backend
  const reloadSalaries = useCallback(async () => {
    try {
      const resProfiles = await fetch(`/project-profiles/${projectId}`);
      if (!resProfiles.ok) throw new Error('No se pudieron obtener los perfiles del proyecto');
      const projectProfiles: Array<{ id: number; project_profile_id?: number }> = await resProfiles.json();

      const items = await Promise.all(
        projectProfiles.map(async (p) => {
          const ppId = p.project_profile_id;
          if (!ppId) return { profileId: p.id, salaries: {} as Record<string, number> };

          const res = await fetch(`/project-profile-salaries?project_profile_id=${ppId}&ts=${Date.now()}`);
          if (!res.ok) return { profileId: p.id, salaries: {} as Record<string, number> };

          const list: Array<{ country_id: number | string; salary: number }> = await res.json();
          const map = list.reduce((acc, row) => {
            acc[String(row.country_id)] = Number(row.salary);
            return acc;
          }, {} as Record<string, number>);

          return { profileId: p.id, salaries: map };
        })
      );

      const map = items.reduce((acc, it) => {
        acc[String(it.profileId)] = it.salaries;
        return acc;
      }, {} as { [profileId: string]: { [countryId: string]: number } });

      setProjectProfileSalaries(map);
    } catch (e) {
      console.error('Error al recargar salarios:', e);
    }
  }, [projectId]);

  // Carga inicial y cuando cambie la cantidad de filas (crear/eliminar)
  useEffect(() => {
    reloadSalaries();
  }, [reloadSalaries, tableData.length]);

  // helper para leer un salario en el render
  const getSalary = (profileId: number, countryId: number | string) =>
    projectProfileSalaries?.[String(profileId)]?.[String(countryId)] ?? '';

  // Guardar edición de perfil existente
  const handleEditProfileSave = useCallback(async () => {
    if (!editingProfile || !editingProfile.name?.trim()) {
      alert('El nombre del perfil es obligatorio');
      return;
    }

    const originalProfile = tableData.find(p => p.id === editingProfile.id);
    const originalIsOfficial = !!originalProfile?.is_official;
    const newIsOfficial = officialProfiles.some(p => p.name === editingProfile.name);
    const officialProfile = officialProfiles.find(p => p.name === editingProfile.name);
    const currentProjectId = projectId;

    try {
      console.log('🔹 Guardando perfil editado:', editingProfile);

      // 1️⃣ Obtener project_profiles iniciales
      const getProjectProfiles = async () => {
        const resp = await fetch(`/project-profiles/${currentProjectId}`);
        if (!resp.ok) throw new Error('No se pudieron obtener los perfiles del proyecto');
        return resp.json() as Promise<Array<{ id: number; project_profile_id: number }>>;
      };

      let projectProfilesData = await getProjectProfiles();

      // Buscar relación inicial
      let projectProfileEntry = projectProfilesData.find(
        (pp) => Number(pp.id) === Number(editingProfile.id)
      );

      // 2️⃣ Lógica de edición de perfil
      if (!originalIsOfficial && !newIsOfficial) {
        await fetch(`/profiles/${editingProfile.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingProfile.name,
            salaries: editingProfile.salaries,
            is_official: false
          })
        });
      } else if (originalIsOfficial && !newIsOfficial) {
        if (!originalProfile) return alert('No se encontró el perfil original.');
        await fetch('/project-profiles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, profile_id: originalProfile.id })
        });
        const res = await fetch('/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editingProfile.name,
            salaries: editingProfile.salaries,
            is_official: false
          })
        });
        if (!res.ok) throw new Error((await res.text()) || 'No se pudo crear el perfil');
        const { id: newProfileId } = await res.json();
        await addProfileToProject(currentProjectId, newProfileId);
        editingProfile.id = newProfileId; // actualizar ID para buscar salarios
      } else if (!originalIsOfficial && newIsOfficial && officialProfile) {
        if (!originalProfile) return alert('No se encontró el perfil original.');
        await fetch('/project-profiles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, profile_id: originalProfile.id })
        });
        await fetch(`/profiles/${originalProfile.id}`, { method: 'DELETE' });
        await addProfileToProject(currentProjectId, Number(officialProfile.id));
        editingProfile.id = Number(officialProfile.id); // actualizar ID
      } else if (
        originalIsOfficial &&
        newIsOfficial &&
        officialProfile &&
        originalProfile.name !== editingProfile.name
      ) {
        await fetch('/project-profiles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, profile_id: originalProfile.id })
        });
        await addProfileToProject(currentProjectId, Number(officialProfile.id));
        editingProfile.id = Number(officialProfile.id);
      }

      // 3️⃣ Volver a obtener el project_profile_id correcto después de cambios
      projectProfilesData = await getProjectProfiles();
      projectProfileEntry = projectProfilesData.find(
        (pp) => Number(pp.id) === Number(editingProfile.id)
      );
      const projectProfileId = projectProfileEntry?.project_profile_id;
      console.log('🔹 Project profile ID final para salarios:', projectProfileId);

      if (!projectProfileId) {
        console.warn('⚠️ No se encontró project_profile_id después de editar perfil');
        return;
      }

      // 4️⃣ Obtener salarios existentes
      const existingSalariesRes = await fetch(
        `/project-profile-salaries?project_profile_id=${projectProfileId}`
      );
      const existingSalaries: Array<{ id: number; country_id: string | number; salary: string }> =
        existingSalariesRes.ok ? await existingSalariesRes.json() : [];

      console.log('🔹 Salarios existentes:', existingSalaries);
      console.log('🔹 Salarios nuevos:', editingProfile.salaries);

      // 5️⃣ Crear/Actualizar salarios
      const salaryPromises: Promise<Response>[] = [];

      for (const [countryId, salary] of Object.entries(editingProfile.salaries || {})) {
        const existingSalary = existingSalaries.find(
          (s) => String(s.country_id) === String(countryId)
        );

        const newSalaryNum = Number(salary);

        if (existingSalary) {
          const existingSalaryNum = Number(existingSalary.salary);
          if (existingSalaryNum !== newSalaryNum) {
            console.log(`🔸 PUT salario país ${countryId}: ${existingSalaryNum} → ${newSalaryNum}`);
            salaryPromises.push(
              fetch(`/project-profile-salaries/${existingSalary.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  project_profile_id: projectProfileId,
                  country_id: countryId,
                  salary: newSalaryNum
                }),
              })
            );
          }
        } else if (newSalaryNum > 0) {
          console.log(`🟢 POST salario país ${countryId}: ${newSalaryNum}`);
          salaryPromises.push(
            fetch(`/project-profile-salaries`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_profile_id: projectProfileId,
                country_id: countryId,
                salary: newSalaryNum,
              }),
            })
          );
        }
      }

      await Promise.all(salaryPromises);

      // Recargar salarios después de editar
      await reloadSalaries();

      // 6️⃣ Refrescar tabla
      const resProfiles = await fetch(`/project-profiles/${currentProjectId}`);
      if (resProfiles.ok) {
        const profiles = await resProfiles.json();
        setTableData(profiles);
        onChange(profiles);
      }

      console.log('✅ Edición guardada con éxito');
      setEditingProfile(null);
    } catch (e) {
      console.error('❌ Error guardando perfil:', e);
      alert('Error guardando perfil: ' + (e instanceof Error ? e.message : e));
    }
  }, [editingProfile, officialProfiles, projectId, tableData, onChange, reloadSalaries]);

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
  const handleEditProfile = useCallback(async (profile: Profile) => {
    try {
      const currentProjectId = projectId;
      const profileId = profile.id;

      // 1️⃣ Obtener project_profiles del proyecto
      const projectProfilesResponse = await fetch(`/project-profiles/${currentProjectId}`);
      if (!projectProfilesResponse.ok) {
        throw new Error('No se pudieron obtener los perfiles del proyecto');
      }

      const projectProfilesData: Array<{ id: number; name: string; project_profile_id: number }> =
        await projectProfilesResponse.json();

      console.log("projectProfilesData:", projectProfilesData);

      // 2️⃣ Localizar la entrada que corresponde al perfil que estamos editando
      const projectProfileEntry = projectProfilesData.find(
        (pp) => Number(pp.id) === Number(profileId)
      );

      if (!projectProfileEntry) {
        console.warn(`No se encontró relación project_profile para perfil ${profileId} en proyecto ${currentProjectId}`);
        setEditingProfile({ ...profile, salaries: {} });
        return;
      }

      const projectProfileId = projectProfileEntry.project_profile_id;

      // 3️⃣ Obtener salarios actuales para ese project_profile_id
      const salariesResponse = await fetch(
        `/project-profile-salaries?project_profile_id=${projectProfileId}`
      );
      if (!salariesResponse.ok) {
        throw new Error('No se pudieron obtener los salarios de este perfil en el proyecto');
      }

      const salariesData: Array<{ country_id: string | number; salary: number }> =
        await salariesResponse.json();

      // 4️⃣ Mapear salarios { [countryId]: salary }
      const salariesMap: { [countryId: string]: number } = {};
      salariesData.forEach((row) => {
        salariesMap[String(row.country_id)] = row.salary;
      });

      // 5️⃣ Guardar en estado editable
      setEditingProfile({
        ...profile,
        salaries: salariesMap,
      });
    } catch (error) {
      console.error('Error al preparar la edición del perfil:', error);
      setEditingProfile({ ...profile, salaries: {} });
    }
  }, [projectId]);

  // Actualizar perfil en edición
  const handleProfileChange = useCallback((field: string, value: string) => {
    setEditingProfile((prev: Partial<Profile> | null): Partial<Profile> | null => {
      if (!prev) return null;
      if (field === 'name') {
        setNameInput(value);
        setShowSuggestions(true);
        const officialProfile = officialProfiles.find((p: { id: string; name: string }) => p.name === value);
        if (officialProfile) {
          // Fetch salarios oficiales dinámicamente
          fetch(`/project-profiles/${officialProfile.id}/salaries`)
          .then(res => res.json())
          .then((data: Array<{ country_id: string | number; salary: number }>) => {
            setEditingProfile((current: Partial<Profile> | null): Partial<Profile> | null => {
            if (!current) return null;
            // Mapear salarios por país
            interface SalaryMap {
              [countryId: string]: number;
            }
            const salaries: SalaryMap = {};
            data.forEach((row: { country_id: string | number; salary: number }) => {
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
      interface Salaries {
        [countryId: string]: number;
      }
      return {
        ...prev,
        salaries: { ...(prev.salaries as Salaries), [field]: Number(value) || 0 }
      };
    });
  }, [officialProfiles]);

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

  // Guardar perfil nuevo
  const handleSaveProfile = useCallback(async () => {
    if (!editingProfile || !editingProfile.name?.trim()) {
      alert('El nombre del perfil es obligatorio');
      return;
    }

    // Buscar si es oficial
    const officialProfile = officialProfiles.find((p) => p.name === editingProfile.name);

    try {
      let profileId;
      if (officialProfile) {
        const resProjectProfile = await fetch('/project-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            profile_id: officialProfile.id,
            salaries: editingProfile.salaries || {}
          })
        });
        if (resProjectProfile.status === 409) {
          alert('This profile is already existing in this project');
          return;
        }
        if (!resProjectProfile.ok) {
          throw new Error((await resProjectProfile.text()) || 'Error linking profile');
        }
        profileId = officialProfile.id;
      } else {
        // Crear perfil (o reutilizado si backend lo devuelve reused)
        const res = await fetch('/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editingProfile.name, is_official: false })
        });
        if (!res.ok) throw new Error((await res.text()) || 'Error creating profile');
        const created = await res.json();
        profileId = created.id;

        const resProjectProfile = await fetch('/project-profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            profile_id: profileId,
            salaries: editingProfile.salaries || {}
          })
        });
        if (resProjectProfile.status === 409) {
          alert('This profile is already existing in this project');
          return;
        }
        if (!resProjectProfile.ok) {
          throw new Error((await resProjectProfile.text()) || 'Error linking profile');
        }
      }

      // Refrescar la tabla de perfiles tras guardar
      const resProfiles = await fetch(`/project-profiles/${projectId}`);
      if (resProfiles.ok) {
        const profiles = await resProfiles.json();
        setTableData(profiles);
        onChange(profiles);
        
        // Recargar salarios después de crear
        await reloadSalaries();
      }
      setEditingProfile(null);
    } catch (e) {
      alert('Error guardando perfil: ' + (e instanceof Error ? e.message : e));
    }
  }, [editingProfile, officialProfiles, projectId, onChange, reloadSalaries]);

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
                onChange={(v) => handleProfileChange('name', v)}
                onAddNew={() => Promise.resolve()} // noop
              />
            );
          }
          return profile.name;
        },
      },
      ...countries.map((country) => ({
        key: `salary-${country.id}`,
        title: `Salario ${country.name}`,
        render: (_: any, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            return (
              <input
                type="number"
                value={editingProfile.salaries?.[country.id] || ''}
                onChange={(e) => handleProfileChange(country.id, e.target.value)}
                placeholder={`Salario ${country.name}`}
                className="profile-input salary-input"
              />
            );
          }
          
          // Usar getSalary en lugar de projectProfileSalaries directamente
          const salary = getSalary(profile.id, country.id);
          return salary ? `${Number(salary).toLocaleString()}€` : '-';
        },
      })),
      {
        key: 'actions',
        title: 'Acciones',
        render: (_: any, profile: Profile) => {
          // Si estamos editando esta fila
          if (editingProfile && editingProfile.id === profile.id) {
            // Nuevo perfil: id no existe en tableData (sin nombre) o el nombre está vacío
            const isNew = !tableData.some(p => p.id === editingProfile.id && p.name);
            return (
              <div className="table-row-actions">
                {isNew ? (
                  <Button variant="success" size="sm" onClick={handleSaveProfile} style={{ backgroundColor: '#388e3c', borderColor: '#388e3c' }}>
                    Crear
                  </Button>
                ) : (
                  <Button variant="warning" size="sm" onClick={handleEditProfileSave} style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', color: '#fff' }}>
                    Guardar
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                  Cancelar
                </Button>
              </div>
            );
          }

          // Si no estamos editando
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
                  try {
                    // 1️⃣ Eliminar relación perfil-proyecto
                    console.log('Intentando eliminar relación perfil-proyecto:', { project_id: projectId, profile_id: profile.id });
                    await fetch('/project-profiles', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: projectId, profile_id: profile.id }),
                    });

                    // 4️⃣ Actualizar tabla local
                    const updated = tableData.filter((p) => p.id !== profile.id);
                    console.log('Tabla actualizada:', updated);
                    setTableData(updated);
                    onChange(updated);
                    
                    // Recargar salarios después de eliminar
                    await reloadSalaries();
                  } catch (e) {
                    console.error('Error eliminando proyecto o perfil:', e);
                  }
                }}
              >
                Eliminar
              </Button>
            </div>
          );
        },
      },
    ],
    [
      editingProfile,
      handleProfileChange,
      handleSaveProfile,
      handleEditProfileSave,
      handleCancelEdit,
      handleEditProfile,
      countries,
      tableData,
      onChange,
      projectId,
      profiles,
      getSalary,
      officialProfiles,
      reloadSalaries
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