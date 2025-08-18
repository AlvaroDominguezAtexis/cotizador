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
        placeholder="Profile"
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
  const [expandedRows, setExpandedRows] = useState<Array<string | number>>([]);
  const [hasMultipleYears, setHasMultipleYears] = useState<boolean>(false);
  const [projectCountryIds, setProjectCountryIds] = useState<number[]>([]);
  const [projectYears, setProjectYears] = useState<number[]>([]);
  const [profilesRefreshKey, setProfilesRefreshKey] = useState<number>(0);
  // Edits for per-year salaries: profileId -> ("countryId:year" -> newSalary)
  const [yearSalaryEdits, setYearSalaryEdits] = useState<Record<string, Record<string, number>>>({});

  // Determine if the project has more than one year
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/projects/${projectId}`);
        if (!res.ok) throw new Error('No se pudo obtener el proyecto');
        const p = await res.json();
        const sy = p?.start_date ? parseInt(String(p.start_date).slice(0,4), 10) : NaN;
        const ey = p?.end_date ? parseInt(String(p.end_date).slice(0,4), 10) : sy;
        const years = isNaN(sy) || isNaN(ey) ? 1 : Math.max(1, ey - sy + 1);
        if (!cancelled) {
          setHasMultipleYears(years > 1);
          if (years <= 1) setExpandedRows([]);
          // Persist project countries list (ensure numeric IDs)
          const ids: number[] = Array.isArray(p?.countries) ? p.countries.map((c: any) => Number(c)).filter((n: any) => !isNaN(n)) : [];
          setProjectCountryIds(ids);
          // Persist full years list for rendering empty cells when needed
          if (years > 0 && !isNaN(sy) && !isNaN(ey)) {
            const ylist = Array.from({ length: years }, (_, i) => sy + i);
            setProjectYears(ylist);
          } else {
            setProjectYears([]);
          }
        }
      } catch {
        if (!cancelled) {
          setHasMultipleYears(false);
          setExpandedRows([]);
          setProjectCountryIds([]);
          setProjectYears([]);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [projectId]);

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

          const list: Array<{ country_id: number | string; salary: number; year?: number }> = await res.json();
          // Choose the earliest year salary per country
          const byCountry: Record<string, { year: number; salary: number }> = {};
          for (const row of list) {
            const cid = String(row.country_id);
            const y = row.year ?? Number.MIN_SAFE_INTEGER;
            if (!byCountry[cid] || y < byCountry[cid].year) {
              byCountry[cid] = { year: y, salary: Number(row.salary) };
            }
          }
          const map = Object.fromEntries(Object.entries(byCountry).map(([cid, v]) => [cid, v.salary]));

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

  // Carga inicial y cuando cambie la cantidad de filas (crear/Delete)
  useEffect(() => {
    reloadSalaries();
  }, [reloadSalaries, tableData.length]);

  // helper para leer un Salary en el render
  const getSalary = (profileId: number, countryId: number | string) =>
    projectProfileSalaries?.[String(profileId)]?.[String(countryId)] ?? '';

  // Guardar edición de perfil existente
  const handleEditProfileSave = useCallback(async () => {
    if (!editingProfile || !editingProfile.name?.trim()) {
      alert('Profile´s name is mandatory');
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
        // Crear nuevo perfil no oficial
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
        // Cambiar la relación project_profile al nuevo profile_id preservando salarios/años
        const switchRes = await fetch('/project-profiles/switch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, from_profile_id: originalProfile.id, to_profile_id: newProfileId })
        });
        if (switchRes.status === 409) {
          alert('This profile is already existing in this project');
          return;
        }
        if (!switchRes.ok) throw new Error((await switchRes.text()) || 'No se pudo actualizar la relación de perfil');
        editingProfile.id = newProfileId; // actualizar ID en edición
      } else if (!originalIsOfficial && newIsOfficial && officialProfile) {
        if (!originalProfile) return alert('No se encontró el perfil original.');
        // Cambiar relación al perfil oficial preservando salarios/años
        const switchRes = await fetch('/project-profiles/switch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, from_profile_id: originalProfile.id, to_profile_id: Number(officialProfile.id) })
        });
        if (switchRes.status === 409) {
          alert('This profile is already existing in this project');
          return;
        }
        if (!switchRes.ok) throw new Error((await switchRes.text()) || 'No se pudo actualizar la relación de perfil');
        editingProfile.id = Number(officialProfile.id); // actualizar ID
      } else if (
        originalIsOfficial &&
        newIsOfficial &&
        officialProfile &&
        originalProfile.name !== editingProfile.name
      ) {
        // Cambiar entre perfiles oficiales preservando salarios/años
        const switchRes = await fetch('/project-profiles/switch', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: currentProjectId, from_profile_id: originalProfile.id, to_profile_id: Number(officialProfile.id) })
        });
        if (switchRes.status === 409) {
          alert('This profile is already existing in this project');
          return;
        }
        if (!switchRes.ok) throw new Error((await switchRes.text()) || 'No se pudo actualizar la relación de perfil');
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
        console.warn('⚠️ No se encontró project_profile_id después de Edit perfil');
        return;
      }

      // 4️⃣-5️⃣ Salarios: si el proyecto es multi-año, no actualizamos desde la fila principal.
      // En su lugar, aplicamos los cambios acumulados en la tabla por año (ediciones masivas).
      const isNew = !tableData.some(p => p.id === editingProfile.id && p.name);
      if (hasMultipleYears && !isNew) {
        const editsForProfile = yearSalaryEdits[String(editingProfile.id || '')] || {};
        const ops: Promise<Response>[] = [];
        // We need project_profile_id to resolve create/update per row
        const resProfiles = await fetch(`/project-profiles/${currentProjectId}`);
        const pps: Array<{ id: number; project_profile_id: number }> = await resProfiles.json();
        const pp = pps.find(p => Number(p.id) === Number(editingProfile.id));
        if (!pp) throw new Error('No project_profile_id found');

        // Fetch existing rows to know which composite keys already exist
        const resExisting = await fetch(`/project-profile-salaries?project_profile_id=${pp.project_profile_id}`);
        const existingList: Array<{ id: number; country_id: number; year: number; salary: number }>
          = resExisting.ok ? await resExisting.json() : [];
        const existingIndex = new Map<string, { id: number; salary: number }>();
        for (const r of existingList) existingIndex.set(`${r.country_id}:${r.year}`, { id: r.id, salary: r.salary });

        for (const [key, newVal] of Object.entries(editsForProfile)) {
          if (newVal == null || isNaN(newVal)) continue;
          const [cidStr, yearStr] = key.split(':');
          const cid = Number(cidStr);
          const yy = Number(yearStr);
          if (existingIndex.has(key)) {
            const { id, salary } = existingIndex.get(key)!;
            if (Number(salary) !== Number(newVal)) {
              ops.push(
                fetch(`/project-profile-salaries/${id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ salary: Number(newVal) })
                })
              );
            }
          } else {
            ops.push(
              fetch(`/project-profile-salaries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  project_profile_id: pp.project_profile_id,
                  country_id: cid,
                  year: yy,
                  salary: Number(newVal)
                })
              })
            );
          }
        }
        if (ops.length > 0) await Promise.all(ops);
      } else {
        const existingSalariesRes = await fetch(
          `/project-profile-salaries?project_profile_id=${projectProfileId}`
        );
        const existingSalaries: Array<{ id: number; country_id: string | number; salary: string }> =
          existingSalariesRes.ok ? await existingSalariesRes.json() : [];

        console.log('🔹 Salarios existentes:', existingSalaries);
        console.log('🔹 Salarios nuevos:', editingProfile.salaries);

        const salaryPromises: Promise<Response>[] = [];
        for (const [countryId, salary] of Object.entries(editingProfile.salaries || {})) {
          const existingSalary = existingSalaries.find(
            (s) => String(s.country_id) === String(countryId)
          );
          const newSalaryNum = Number(salary);
          if (existingSalary) {
            const existingSalaryNum = Number(existingSalary.salary);
            if (existingSalaryNum !== newSalaryNum) {
              console.log(`🔸 PUT Salary país ${countryId}: ${existingSalaryNum} → ${newSalaryNum}`);
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
            console.log(`🟢 POST Salary país ${countryId}: ${newSalaryNum}`);
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
      }

  // Recargar salarios después de Edit
      await reloadSalaries();

      // 6️⃣ Refrescar tabla
      const resProfiles = await fetch(`/project-profiles/${currentProjectId}`);
      if (resProfiles.ok) {
        const profiles = await resProfiles.json();
        setTableData(profiles);
        onChange(profiles);
      }

      // Limpiar ediciones por año para este perfil tras guardar
  setYearSalaryEdits(prev => {
        const copy = { ...prev };
        if (editingProfile?.id != null) delete copy[String(editingProfile.id)];
        return copy;
      });

      console.log('✅ Edición guardada con éxito');
  // Signal accordions to reload their year data
  setProfilesRefreshKey((k) => k + 1);
      setEditingProfile(null);
    } catch (e) {
      console.error('❌ Error guardando perfil:', e);
      alert('Error guardando perfil: ' + (e instanceof Error ? e.message : e));
    }
  }, [editingProfile, officialProfiles, projectId, tableData, onChange, reloadSalaries, hasMultipleYears, yearSalaryEdits]);

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

  // Edit un perfil existente
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

      const salariesData: Array<{ country_id: string | number; salary: number; year?: number }> =
        await salariesResponse.json();

      // 4️⃣ Mapear salarios del primer año { [countryId]: salary }
      const earliest: { [countryId: string]: { year: number; salary: number } } = {};
      for (const row of salariesData) {
        const key = String(row.country_id);
        const y = row.year ?? Number.MIN_SAFE_INTEGER;
        if (!earliest[key] || y < earliest[key].year) {
          earliest[key] = { year: y, salary: Number(row.salary) };
        }
      }
      const salariesMap: { [countryId: string]: number } = Object.fromEntries(
        Object.entries(earliest).map(([cid, v]) => [cid, v.salary])
      );

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
      alert('Profile´s name is mandatory');
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
    // Descartar ediciones por año del perfil en edición
    setYearSalaryEdits(prev => {
      const copy = { ...prev };
      if (editingProfile?.id != null) delete copy[String(editingProfile.id)];
      return copy;
    });
  }, [editingProfile, tableData, onChange]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'name',
        title: 'Profile',
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
        title: `Salary ${country.name}`,
        render: (_: any, profile: Profile) => {
          if (editingProfile && editingProfile.id === profile.id) {
            // Detect if this is a new row being created (no persisted name yet)
            const isNew = !tableData.some(p => p.id === editingProfile.id && p.name);
            // In multi-year projects, block main-row salary editing for existing profiles
            if (hasMultipleYears && !isNew) {
              const salary = getSalary(profile.id, country.id);
              return (
                <span title="Edita los salarios en la tabla por año de la fila expandida">
                  {salary ? `${Number(salary).toLocaleString()}€` : '-'}
                </span>
              );
            }
            // Single-year projects or new profile creation: allow inline editing here
            return (
              <input
                type="number"
                value={editingProfile.salaries?.[country.id] || ''}
                onChange={(e) => handleProfileChange(country.id, e.target.value)}
                placeholder={`Salary ${country.name}`}
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
        title: 'Actions',
        render: (_: any, profile: Profile) => {
          // Si estamos editando esta fila
          if (editingProfile && editingProfile.id === profile.id) {
            // Nuevo perfil: id no existe en tableData (sin nombre) o el nombre está vacío
            const isNew = !tableData.some(p => p.id === editingProfile.id && p.name);
            const pendingCount = hasMultipleYears && !isNew
              ? Object.keys(yearSalaryEdits[String(editingProfile.id || '')] || {}).length
              : 0;
            return (
              <div className="table-row-actions">
                {isNew ? (
                  <Button variant="success" size="sm" onClick={handleSaveProfile} style={{ backgroundColor: '#388e3c', borderColor: '#388e3c' }}>
                    Crear
                  </Button>
                ) : (
                  <Button variant="warning" size="sm" onClick={handleEditProfileSave} style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', color: '#fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span>Guardar</span>
                    {pendingCount > 0 && <span className="pending-badge" title={`${pendingCount} cambios sin guardar`}>{pendingCount}</span>}
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
                onClick={() => {
                  // Expand row and enter edit mode (only if multi-year)
                  if (hasMultipleYears) {
                    setExpandedRows(prev => Array.from(new Set([...(prev || []), profile.id])));
                  }
                  handleEditProfile(profile);
                }}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  try {
                    // 1️⃣ Delete relación perfil-proyecto
                    console.log('Intentando Delete relación perfil-proyecto:', { project_id: projectId, profile_id: profile.id });
                    const delRes = await fetch('/project-profiles', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ project_id: projectId, profile_id: profile.id }),
                    });
                    if (!delRes.ok) {
                      const msg = await delRes.text();
                      let detail = '';
                      let code = '';
                      let stepsCount = 0;
                      let stepNames: string[] = [];
                      try { const j = JSON.parse(msg); detail = j?.error || msg; code = j?.code; stepsCount = j?.stepsCount || 0; stepNames = Array.isArray(j?.stepNames) ? j.stepNames : []; } catch { detail = msg; }
                      if (code === 'PROFILE_IN_USE') {
                        const preview = stepNames.slice(0, 5).join(', ');
                        const more = stepsCount > stepNames.length ? ` and ${stepsCount - stepNames.length} more` : '';
                        const suffix = preview ? `\nSteps: ${preview}${more}` : '';
                        const confirmText = `There are associated steps to this profile. By deleting this profile, associated steps will be deleted. Are you sure you want to delete it?${suffix}`;
                        const confirmed = window.confirm(confirmText);
                        if (!confirmed) return;
                        const forceRes = await fetch('/project-profiles', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ project_id: projectId, profile_id: profile.id, force: true })
                        });
                        if (!forceRes.ok) {
                          const m2 = await forceRes.text();
                          let d2 = '';
                          try { const j2 = JSON.parse(m2); d2 = j2?.error || m2; } catch { d2 = m2; }
                          alert(d2 || 'Cannot delete this profile right now.');
                          return;
                        }
                      } else {
                        alert(detail || 'Cannot delete this profile right now.');
                        return;
                      }
                    }

                    // 4️⃣ Actualizar tabla local
                    const updated = tableData.filter((p) => p.id !== profile.id);
                    console.log('Tabla actualizada:', updated);
                    setTableData(updated);
                    onChange(updated);
                    
                    // Recargar salarios después de Delete
                    await reloadSalaries();
                  } catch (e) {
                    console.error('Error eliminando proyecto o perfil:', e);
                    alert('Error deleting profile from project');
                  }
                }}
              >
                Delete
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
  expandable={hasMultipleYears ? {
        rowExpandable: () => true,
        expandedRowKeys: expandedRows,
        onExpand: (expanded: boolean, record: Profile) => {
          setExpandedRows(prev => {
            const set = new Set(prev);
            const key = record.id as unknown as string | number;
            if (expanded) set.add(key); else set.delete(key);
            return Array.from(set);
          });
        },
        expandedRowRender: (profile: Profile) => (
          <ProfileYearSalaries
            profile={profile}
            projectId={projectId}
            countries={countries}
            editing={!!editingProfile && Number(editingProfile.id) === Number(profile.id)}
            yearEdits={yearSalaryEdits[String(profile.id)] || {}}
            onYearEditChange={(rowId: number, value: number | null) => {
              // Unused in composite-key mode
            }}
      projectCountryIds={projectCountryIds}
            projectYears={projectYears}
            onCompositeEditChange={(countryId: number, year: number, value: number | null) => {
              setYearSalaryEdits(prev => {
                const pid = String(profile.id);
                const copy = { ...prev } as Record<string, Record<string, number>>;
                const current = { ...(copy[pid] || {}) } as Record<string, number>;
                const k = `${countryId}:${year}`;
                if (value == null || isNaN(value)) delete current[k]; else current[k] = Number(value);
                if (Object.keys(current).length === 0) delete copy[pid]; else copy[pid] = current;
                return copy;
              });
            }}
            reloadSignal={profilesRefreshKey}
          />
        )
  } : undefined}
    />
  );
};

const ProfileYearSalaries: React.FC<{ profile: Profile; projectId: number; countries: { id: string; name: string }[]; editing?: boolean; yearEdits: Record<string, number>; onYearEditChange: (rowId: number, value: number | null) => void; projectCountryIds: number[]; projectYears: number[]; onCompositeEditChange: (countryId: number, year: number, value: number | null) => void; reloadSignal?: number }> = ({ profile, projectId, countries, editing = false, yearEdits, onYearEditChange, projectCountryIds, projectYears, onCompositeEditChange, reloadSignal = 0 }) => {
  const [yearsData, setYearsData] = React.useState<Array<{ id: number; country_id: number; year: number; salary: number }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [cpiByCountry, setCpiByCountry] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        // Need project_profile_id for this profile
        const resProfiles = await fetch(`/project-profiles/${projectId}`);
        if (!resProfiles.ok) throw new Error('No se pudieron obtener los perfiles del proyecto');
        const pps: Array<{ id: number; project_profile_id: number }> = await resProfiles.json();
        const pp = pps.find(p => Number(p.id) === Number(profile.id));
        if (!pp) { setYearsData([]); return; }
  const res = await fetch(`/project-profile-salaries?project_profile_id=${pp.project_profile_id}`);
        if (!res.ok) throw new Error('No se pudieron obtener salarios por año');
  const list: Array<{ id: number; country_id: number; year: number; salary: number }> = await res.json();
        if (mounted) setYearsData(list);
        // Fetch CPI per project country
        const resCpi = await fetch(`/projects/${projectId}/countries-cpi`);
        if (resCpi.ok) {
          const cpidata = await resCpi.json();
          // Try to parse as array of objects with country_id and cpi or similar
          const map: Record<number, number> = {};
          if (Array.isArray(cpidata)) {
            for (const row of cpidata) {
              const cid = Number(row.country_id ?? row.countryId ?? row.id);
              const cpi = Number(row.cpi ?? row.CPI ?? row.value);
              if (!isNaN(cid) && !isNaN(cpi)) map[cid] = cpi;
            }
          }
          if (mounted) setCpiByCountry(map);
        }
      } catch (e) {
        console.error(e);
        if (mounted) setYearsData([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [profile.id, projectId, reloadSignal]);

  if (loading) return <div style={{ padding: 12 }}>Cargando salarios por año…</div>;
  if (!yearsData.length) return <div style={{ padding: 12 }}>Sin salarios por año.</div>;

  const countryName = (id: number) => countries.find(c => Number(c.id) === Number(id))?.name || String(id);
  const filtered = yearsData.filter(r => projectCountryIds.includes(Number(r.country_id)));
  const years = projectYears.length > 0 ? projectYears.slice().sort((a,b)=>a-b) : Array.from(new Set(filtered.map(r => r.year))).sort((a,b) => a-b);
  const byCountry = new Map<number, { name: string; rows: Record<number, { id?: number; salary?: number }> }>();
  filtered.forEach(r => {
    const entry = byCountry.get(r.country_id) || { name: countryName(r.country_id), rows: {} as Record<number, { id: number; salary: number }> };
    entry.rows[r.year] = { id: r.id, salary: r.salary };
    byCountry.set(r.country_id, entry);
  });
  // Ensure all project countries are present and fill missing years with empty placeholders
  projectCountryIds.forEach(cid => {
    if (!byCountry.has(cid)) byCountry.set(cid, { name: countryName(cid), rows: {} as Record<number, { id?: number; salary?: number }> });
    const entry = byCountry.get(cid)!;
    years.forEach(y => { if (!entry.rows[y]) entry.rows[y] = {}; });
  });

  const onChangeCell = (countryId: number, year: number, value: string) => {
    const v = Number(value);
    onCompositeEditChange(countryId, year, isNaN(v) ? null : v);
  };

  const applyCpiForCountry = (countryId: number) => {
    const cpi = cpiByCountry[countryId];
    if (cpi == null || isNaN(cpi)) {
      alert('No CPI configured for this country');
      return;
    }
    const entry = byCountry.get(countryId);
    if (!entry) return;
    const ys = years.slice().sort((a,b)=>a-b);
    if (ys.length < 2) return; // nothing to do
    const first = ys[0];
    // Determine base salary: edited override takes precedence, else existing cell salary
    const baseCell = entry.rows[first] || {};
    const baseOverride = yearEdits[`${countryId}:${first}`];
    const baseVal = baseOverride != null ? Number(baseOverride) : (baseCell.salary != null ? Number(baseCell.salary) : NaN);
    if (isNaN(baseVal)) {
      alert('Please set the first-year salary before applying CPI.');
      return;
    }
    let prev = baseVal;
    for (let i = 1; i < ys.length; i++) {
      prev = prev * (1 + cpi / 100);
      // Optionally round to 2 decimals
      const nextVal = Math.round(prev * 100) / 100;
      onCompositeEditChange(countryId, ys[i], nextVal);
    }
  };

  return (
    <div className="profile-ys-wrapper">
      <div className="profile-ys-header">
        <div className="profile-ys-title">
          {editing && Object.keys(yearEdits || {}).length > 0 && (
            <span className="profile-ys-pending" title="Cambios sin guardar en esta tabla">
              {Object.keys(yearEdits).length} cambios sin guardar
            </span>
          )}
        </div>
      </div>
      <div className="profile-ys-table-wrap">
        <table className="profile-ys-table">
          <thead>
            <tr>
              <th className="profile-ys-th left">Country</th>
              {years.map(y => (
                <th key={y} className="profile-ys-th right">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(byCountry.entries()).map(([countryId, entry]) => (
              <tr key={countryId}>
                <td className="profile-ys-td left">
                  <span>{entry.name}</span>
                  {editing && years.length > 1 && (
                    <button type="button" className="profile-ys-cpi-btn" onClick={() => applyCpiForCountry(Number(countryId))}>
                      apply CPI increase
                    </button>
                  )}
                </td>
                {years.map(y => {
                  const cell = entry.rows[y] || {};
                  const compositeKey = `${countryId}:${y}`;
                  const override = yearEdits[compositeKey];
                  const value = override != null ? override : (cell.salary != null ? cell.salary : '');
                  return (
          <td key={y} className={`profile-ys-td right ${override != null ? 'profile-ys-td-dirty' : ''}`}>
                      {!editing ? (
                        <span className="profile-ys-value">{value === '' ? '-' : `${Number(value).toLocaleString()}€`}</span>
                      ) : (
                        <div className="profile-ys-edit">
                          <input
                            type="number"
                            step="0.01"
              className={`profile-ys-input ${override != null ? 'profile-ys-input-dirty' : ''}`}
                            value={value === '' ? '' : Number(value).toString()}
                              onChange={(e) => onChangeCell(Number(countryId), y, e.target.value)}
                          />
                            {/* Guardado masivo: los cambios se aplican al pulsar "Guardar" en la fila principal */}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfilesManagement;