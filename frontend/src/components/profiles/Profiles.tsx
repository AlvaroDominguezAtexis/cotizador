import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useOfficialProfiles } from '../../hooks/useOfficialProfiles';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { round } from '../../utils/functions';
import { apiConfig } from '../../utils/apiConfig';

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

    (async () => {
      try {
        const res = await apiConfig.fetch(`/api/officialprofile-salaries`);
        if (!res.ok) {
          const text = await res.text().catch(() => '<no body>');
          console.error('[useOfficialProfileSalaries] non-ok response', res.status, text);
          return;
        }
        const data = await res.json() as Array<{ profile_id: string | number; country_id: string | number; salary: number }>;
        const map: { [profileId: string]: { [countryId: string]: number } } = {};
        data.forEach(row => {
          const pid = String(row.profile_id);
          const cid = String(row.country_id);
          if (!map[pid]) map[pid] = {};
          map[pid][cid] = row.salary;
        });
        setSalaries(map);
      } catch (e) {
        console.error('[useOfficialProfileSalaries] fetch error', e);
      }
    })();
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
  // Move editingManager state to the top level of the component
  const [editingManager, setEditingManager] = useState<{ [countryId: string]: boolean }>({});

  // Determine if the project has more than one year
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(apiConfig.url(`/api/projects/${projectId}`), {
          ...apiConfig.defaultOptions
        });
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
  // Management yearly salaries per project-country (project_countries.management_yearly_salary)
  const [projectCountryMgmtSalaries, setProjectCountryMgmtSalaries] = useState<{ [countryId: string]: number | null }>({});
  const [loadingProjectCountryMgmt, setLoadingProjectCountryMgmt] = useState(false);
  // Local edits for the Project Manager row (countryId -> string input)
  const [pmEdits, setPmEdits] = useState<{ [countryId: string]: string }>({});

  // Helper para recargar salarios desde el backend
  const reloadSalaries = useCallback(async () => {
    try {
      const resProfiles = await fetch(apiConfig.url(`/api/project-profiles/${projectId}`), {
        ...apiConfig.defaultOptions
      });
      if (!resProfiles.ok) throw new Error('No se pudieron obtener los perfiles del proyecto');
      const projectProfiles: Array<{ id: number; project_profile_id?: number }> = await resProfiles.json();

      const items = await Promise.all(
        projectProfiles.map(async (p) => {
          const ppId = p.project_profile_id;
          if (!ppId) return { profileId: p.id, salaries: {} as Record<string, number> };

          const res = await fetch(apiConfig.url(`/api/project-profile-salaries?project_profile_id=${ppId}&ts=${Date.now()}`), {
            ...apiConfig.defaultOptions
          });
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

  // Load project_countries.management_yearly_salary for the project
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!projectId) return;
      setLoadingProjectCountryMgmt(true);
      try {
        const res = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-management-salary`), {
          ...apiConfig.defaultOptions
        });
        if (!res.ok) throw new Error('Could not load project country management salaries');
        const data: Array<{ country_id: number | string; country_name?: string; management_yearly_salary: number | null }> = await res.json();
        if (!mounted) return;
        const map: { [cid: string]: number | null } = {};
        for (const row of data) map[String(row.country_id)] = row.management_yearly_salary == null ? null : Number(row.management_yearly_salary);
        setProjectCountryMgmtSalaries(map);
      } catch (e) {
        console.error('Error loading project country management salaries', e);
        if (mounted) setProjectCountryMgmtSalaries({});
      } finally {
        if (mounted) setLoadingProjectCountryMgmt(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [projectId]);

  const saveProjectManagerSalary = useCallback(async (countryId: number | string, value: number | null) => {
    if (!projectId) { alert('Save requires a saved project'); return; }
    try {
      const body = { management_yearly_salary: value == null ? null : Number(value) };
      const res = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-management-salary/${countryId}`), {
        ...apiConfig.defaultOptions,
        method: 'PUT',
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setProjectCountryMgmtSalaries(prev => ({ ...prev, [String(countryId)]: updated.management_yearly_salary == null ? null : Number(updated.management_yearly_salary) }));
    } catch (e) {
      console.error('Error saving project manager salary', e);
      alert('No se pudo guardar el salario de manager');
    }
  }, [projectId]);

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

      // 1️⃣ Obtener project_profiles iniciales
      const getProjectProfiles = async () => {
        const resp = await fetch(apiConfig.url(`/api/project-profiles/${currentProjectId}`), {
          ...apiConfig.defaultOptions
        });
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
        await fetch(apiConfig.url(`/api/profiles/${editingProfile.id}`), {
          method: 'PUT',
          ...apiConfig.defaultOptions,
          body: JSON.stringify({
            name: editingProfile.name,
            salaries: editingProfile.salaries,
            is_official: false
          })
        });
      } else if (originalIsOfficial && !newIsOfficial) {
        if (!originalProfile) return alert('No se encontró el perfil original.');
        // Crear nuevo perfil no oficial
        const res = await fetch(apiConfig.url('/api/profiles'), {
          method: 'POST',
          ...apiConfig.defaultOptions,
          body: JSON.stringify({
            name: editingProfile.name,
            salaries: editingProfile.salaries,
            is_official: false
          })
        });
        if (!res.ok) throw new Error((await res.text()) || 'No se pudo crear el perfil');
        const { id: newProfileId } = await res.json();
        // Cambiar la relación project_profile al nuevo profile_id preservando salarios/años
        const switchRes = await fetch(apiConfig.url('/api/project-profiles/switch'), {
          method: 'PUT',
          ...apiConfig.defaultOptions,
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
        const switchRes = await fetch(apiConfig.url('/api/project-profiles/switch'), {
          method: 'PUT',
          ...apiConfig.defaultOptions,
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
        const switchRes = await fetch(apiConfig.url('/api/project-profiles/switch'), {
          method: 'PUT',
          ...apiConfig.defaultOptions,
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
        const resProfiles = await fetch(apiConfig.url(`/api/project-profiles/${currentProjectId}`), {
          ...apiConfig.defaultOptions
        });
        const pps: Array<{ id: number; project_profile_id: number }> = await resProfiles.json();
        const pp = pps.find(p => Number(p.id) === Number(editingProfile.id));
        if (!pp) throw new Error('No project_profile_id found');

        // Fetch existing rows to know which composite keys already exist
        const resExisting = await fetch(apiConfig.url(`/api/project-profile-salaries?project_profile_id=${pp.project_profile_id}`), {
          ...apiConfig.defaultOptions
        });
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
                fetch(apiConfig.url(`/api/project-profile-salaries/${id}`), {
                  ...apiConfig.defaultOptions,
                  method: 'PUT',
                  body: JSON.stringify({ 
                    salary: Number(newVal),
                    year: yy,
                    country_id: cid,
                    project_profile_id: pp.project_profile_id
                  })
                })
              );
            }
          } else {
            ops.push(
              fetch(apiConfig.url(`/api/project-profile-salaries`), {
                ...apiConfig.defaultOptions,
                method: 'POST',
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
          apiConfig.url(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`), 
          { ...apiConfig.defaultOptions }
        );
        const existingSalaries: Array<{ id: number; country_id: string | number; salary: string }> =
          existingSalariesRes.ok ? await existingSalariesRes.json() : [];

        const salaryPromises: Promise<Response>[] = [];
        for (const [countryId, salary] of Object.entries(editingProfile.salaries || {})) {
          const existingSalary = existingSalaries.find(
            (s) => String(s.country_id) === String(countryId)
          );
          const newSalaryNum = Number(salary);
          if (existingSalary) {
            const existingSalaryNum = Number(existingSalary.salary);
            if (existingSalaryNum !== newSalaryNum) {
              const firstYear = projectYears.length > 0 ? projectYears[0] : new Date().getFullYear();
              salaryPromises.push(
                fetch(apiConfig.url(`/api/project-profile-salaries/${existingSalary.id}`), {
                  ...apiConfig.defaultOptions,
                  method: 'PUT',
                  body: JSON.stringify({
                    project_profile_id: projectProfileId,
                    country_id: countryId,
                    salary: newSalaryNum,
                    year: firstYear
                  }),
                })
              );
            }
          } else if (newSalaryNum > 0) {
            // Para proyectos de un solo año, usar el primer año del proyecto
            const firstYear = projectYears.length > 0 ? projectYears[0] : new Date().getFullYear();
            salaryPromises.push(
              fetch(apiConfig.url(`/api/project-profile-salaries`), {
                ...apiConfig.defaultOptions,
                method: 'POST',
                body: JSON.stringify({
                  project_profile_id: projectProfileId,
                  country_id: countryId,
                  salary: newSalaryNum,
                  year: firstYear,
                }),
              })
            );
          }
        }
        if (salaryPromises.length > 0) {
          await Promise.all(salaryPromises);
        }
      }

      // Recargar salarios después de Edit
      await reloadSalaries();

      // 6️⃣ Refrescar tabla
      const resProfiles = await fetch(apiConfig.url(`/api/project-profiles/${currentProjectId}`), {
        ...apiConfig.defaultOptions
      });
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
      const projectProfilesResponse = await fetch(apiConfig.url(`/api/project-profiles/${currentProjectId}`), {
        ...apiConfig.defaultOptions
      });
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
        apiConfig.url(`/api/project-profile-salaries?project_profile_id=${projectProfileId}`),
        { ...apiConfig.defaultOptions }
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
          // Try to use preloaded official salaries from the hook to prefill editing values
          try {
            const hookData = officialSalaries?.[String(officialProfile.id)];
            if (hookData && Object.keys(hookData).length > 0) {
              const salariesMap: { [cid: string]: number } = {};
              const pmMap: { [cid: string]: string } = {};
              for (const [cid, sal] of Object.entries(hookData)) {
                const num = Number(sal);
                if (!isNaN(num)) {
                  salariesMap[cid] = num;
                  pmMap[cid] = String(num);
                }
              }
              setPmEdits(prev => ({ ...prev, ...pmMap }));
              setEditingProfile(current => {
                if (!current) return current;
                return { ...current, name: value, is_official: true, salaries: { ...(current.salaries || {}), ...salariesMap } } as Partial<Profile>;
              });
              return { ...prev, name: value, is_official: true };
            }
          } catch (e) {
            console.warn('[Profiles] officialSalaries hook read failed', e);
          }

          // Fallback: fetch per-profile official salaries if hook had no data
          fetch(apiConfig.url(`/api/project-profiles/${officialProfile.id}/salaries`), {
            ...apiConfig.defaultOptions
          })
            .then(res => res.json())
            .then((data: Array<{ country_id: string | number; salary: number }>) => {
              setEditingProfile((current: Partial<Profile> | null): Partial<Profile> | null => {
                if (!current) return null;
                const salaries: { [countryId: string]: number } = {};
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
            }).catch(e => console.warn('[Profiles] fetch official salaries failed', e));

          return { ...prev, name: value, is_official: true };
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
      await fetch(apiConfig.url('/api/project-profiles'), {
        method: 'POST',
        ...apiConfig.defaultOptions,
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
        const resProjectProfile = await fetch(apiConfig.url('/api/project-profiles'), {
          method: 'POST',
          ...apiConfig.defaultOptions,
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
        const res = await fetch(apiConfig.url('/api/profiles'), {
          method: 'POST',
          ...apiConfig.defaultOptions,
          body: JSON.stringify({ name: editingProfile.name, is_official: false })
        });
        if (!res.ok) throw new Error((await res.text()) || 'Error creating profile');
        const created = await res.json();
        profileId = created.id;

        const resProjectProfile = await fetch(apiConfig.url('/api/project-profiles'), {
          method: 'POST',
          ...apiConfig.defaultOptions,
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
      const resProfiles = await fetch(apiConfig.url(`/api/project-profiles/${projectId}`), {
        ...apiConfig.defaultOptions
      });
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
  ...countries.map((country, index) => ({
        key: `salary-${country.id}`,
        title: `Salary ${country.name}`,
        render: (_: any, profile: Profile) => {
          const cid = String(country.id);
          const serverSalary = getSalary(profile.id, country.id);
          const isEditing = editingProfile && editingProfile.id === profile.id;

          // When editing prefer local edits (pmEdits), then editingProfile.salaries (which we prefill from official hook), then serverSalary
          let displayRaw: string | number = '';
          if (isEditing) {
            if (pmEdits && pmEdits[cid] != null && String(pmEdits[cid]).trim() !== '') displayRaw = pmEdits[cid];
            else if (editingProfile && editingProfile.salaries && editingProfile.salaries[cid] != null) displayRaw = editingProfile.salaries[cid];
            else if (serverSalary) displayRaw = serverSalary;
          } else {
            displayRaw = serverSalary;
          }

          const displayValue = displayRaw === '' || displayRaw == null ? '' : `${Number(displayRaw).toLocaleString()}€`;

          return (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={displayValue}
                onChange={isEditing ? (e) => {
                  const raw = e.target.value.replace(/[^0-9.,-]/g, '').replace(',', '.');
                  setPmEdits(prev => ({ ...prev, [cid]: raw }));
                  // also update editingProfile.salaries so placeholders/readbacks reflect immediately
                  setEditingProfile(prev => {
                    if (!prev) return prev;
                    const prevSals = (prev.salaries || {}) as { [k: string]: number };
                    const n = Number(raw);
                    return { ...prev, salaries: { ...prevSals, [cid]: isNaN(n) ? 0 : n } } as Partial<Profile>;
                  });
                } : undefined}
                className="profile-input salary-input"
                readOnly={!isEditing}
                style={{
                  backgroundColor: isEditing ? '#fff' : '#f5f5f5',
                  color: isEditing ? '#000' : '#666',
                  border: isEditing ? '1px solid #ddd' : '1px solid transparent',
                  boxShadow: isEditing ? undefined : 'inset 0 2px 6px rgba(0,0,0,0.06)',
                  borderRadius: 6,
                  padding: '6px 8px',
                }}
              />
            </div>
          );
        },
      })),
      {
        key: 'actions',
        title: 'Actions',
        render: (_: any, profile: Profile) => {
          // Restore the normal "Edit" button logic for profiles
          if (editingProfile && editingProfile.id === profile.id) {
            const isNew = !tableData.some(p => p.id === editingProfile.id && p.name);
            const pendingCount = hasMultipleYears && !isNew
              ? Object.keys(yearSalaryEdits[String(editingProfile.id || '')] || {}).length
              : 0;
            return (
              <div className="table-row-actions">
                {isNew ? (
                  <Button variant="success" size="sm" onClick={handleSaveProfile}>
                    Crear
                  </Button>
                ) : (
                  <Button variant="warning" size="sm" onClick={handleEditProfileSave}>
                    Guardar
                  </Button>
                )}
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
                Edit
              </Button>
              {profile.name !== 'Project Manager' && profile.id !== -1 && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    try {
                      const delRes = await fetch(apiConfig.url('/api/project-profiles'), {
                        method: 'DELETE',
                        ...apiConfig.defaultOptions,
                        body: JSON.stringify({ project_id: projectId, profile_id: profile.id }),
                      });
                      if (!delRes.ok) {
                        alert('Cannot delete this profile right now.');
                        return;
                      }
                      const updated = tableData.filter((p) => p.id !== profile.id);
                      setTableData(updated);
                      onChange(updated);
                      await reloadSalaries();
                    } catch (e) {
                      console.error('Error deleting profile:', e);
                      alert('Error deleting profile from project');
                    }
                  }}
                >
                  Delete
                </Button>
              )}
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
        Add profile
      </Button>
    ),
    [handleAddNewProfile]
  );

    // Data shown in the table (profiles only)
    const displayedData = React.useMemo(() => {
      return [...tableData];
    }, [tableData]);
    console.log('[ProfilesManagement] displayedData (first 5):', displayedData.slice(0, 5));
    console.log('[ProfilesManagement] countries:', countries);
    console.log('[ProfilesManagement] projectCountryMgmtSalaries:', projectCountryMgmtSalaries);

  return (
    <div className="profiles-management-container">
      <Table
        data={displayedData}
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
    </div>
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
        const resProfiles = await fetch(apiConfig.url(`/api/project-profiles/${projectId}`), {
          ...apiConfig.defaultOptions
        });
        if (!resProfiles.ok) throw new Error('No se pudieron obtener los perfiles del proyecto');
        const pps: Array<{ id: number; project_profile_id: number }> = await resProfiles.json();
        const pp = pps.find(p => Number(p.id) === Number(profile.id));
        if (!pp) { setYearsData([]); return; }
        const res = await fetch(apiConfig.url(`/api/project-profile-salaries?project_profile_id=${pp.project_profile_id}`), {
          ...apiConfig.defaultOptions
        });
        if (!res.ok) throw new Error('No se pudieron obtener salarios por año');
        const list: Array<{ id: number; country_id: number; year: number; salary: number }> = await res.json();
        if (mounted) setYearsData(list);
        // Fetch CPI per project country
        const resCpi = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-cpi`), {
          ...apiConfig.defaultOptions
        });
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

  if (loading) return <div style={{ padding: 12 }}>Loading salaries by year…</div>;
  if (!yearsData.length) return <div style={{ padding: 12 }}>No salaries by year.</div>;

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
      // Round to 2 decimals using centralized function
      const nextVal = round(prev);
      onCompositeEditChange(countryId, ys[i], nextVal);
    }
  };

  return (
    <div className="profile-ys-wrapper">
      <div className="profile-ys-header">
        <div className="profile-ys-title">
          {editing && Object.keys(yearEdits || {}).length > 0 && (
            <span className="profile-ys-pending" title="Cambios sin guardar en esta tabla">
              {Object.keys(yearEdits).length} changes pending
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