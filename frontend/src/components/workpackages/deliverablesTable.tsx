import React, { useState, useEffect } from 'react';
import { Deliverable, Step } from '../../types/workPackages';
import { Button } from '../ui/Button';
import StepsTable from './StepsTable';
import './WorkPackages.css';
import { createDeliverableApi, updateDeliverableApi, deleteDeliverableApi, fetchDeliverables } from '../../api/deliverablesApi';
import { fetchSteps, createStepApi, updateStepApi, deleteStepApi, API_BASE } from '../../api/stepsApi';

interface Props {
  deliverables: Deliverable[]; // initial fallback list (will be overridden by backend fetch)
  onAdd: (d: Deliverable) => void; // kept for upward sync/backward compat
  onUpdate: (d: Deliverable) => void;
  onDelete: (id: number) => void;
  projectYears: number[]; // siempre >= 1
  profileOptions?: { id: number; name: string }[];
  countryOptions?: { id: string; name: string }[];
  createNew?: boolean;
  onCancelCreate?: () => void;
  projectId?: number | null;
  workPackageId?: number | null;
  onLoadedCount?: (count: number) => void;
}

const DeliverablesTable: React.FC<Props> = ({
  deliverables,
  onAdd,
  onUpdate,
  onDelete,
  projectYears,
  profileOptions = [],
  countryOptions = [],
  createNew = false,
  onCancelCreate,
  projectId,
  workPackageId,
  onLoadedCount
}) => {
  const [editingDeliverable, setEditingDeliverable] = useState<Partial<Deliverable> | null>(null);
  const [expandedDeliverable, setExpandedDeliverable] = useState<number | null>(null);
  const [creatingStepFor, setCreatingStepFor] = useState<number | null>(null);
  const [items, setItems] = useState<Deliverable[]>(deliverables || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const mapRemoteStep = (r: any): Step => {
    const profileName = profileOptions.find(p => p.id === r.profile_id)?.name || String(r.profile_id);
    const countryName = countryOptions.find(c => String(c.id) === String(r.country_id))?.name || String(r.country_id);
    return {
      id: r.id,
      name: r.nombre,
      profile: profileName,
      country: countryName,
  city: r.city || null,
  city_id: r.city_id ?? null,
      processTime: r.process_time,
      units: r.unit,
      office: (r.office ? 'Yes' : 'No') as Step['office'],
      mngPercent: r.mng,
      licenses: [],
      hardware: (r.hardware ? 'Yes' : 'No'),
      year: r.year ?? null,
    } as Step;
  };

  const refreshDeliverableSteps = async (deliverableId: number) => {
    if (!projectId || !workPackageId) return;
    try {
      const remote = await fetchSteps(projectId, workPackageId, deliverableId);
      const mappedBase: any[] = (remote || []).map(mapRemoteStep);
      // Resolve missing city names by fetching cities per country when city_id present
      const cityCache: Record<string, Array<{id:any;name:string}>> = {};
      for (const s of mappedBase) {
        if ((!s.city || s.city === null) && s.city_id != null) {
          // try to find country id from countryOptions
          const countryObj = countryOptions.find(c => String(c.name) === String(s.country) || String(c.id) === String(s.country));
          const countryId = countryObj ? countryObj.id : null;
          if (countryId == null) continue;
          const cacheKey = String(countryId);
          if (!cityCache[cacheKey]) {
            try {
              const res = await fetch(`${API_BASE}/countries/${countryId}/cities`);
              if (res.ok) cityCache[cacheKey] = await res.json(); else cityCache[cacheKey] = [];
            } catch { cityCache[cacheKey] = []; }
          }
          const found = cityCache[cacheKey].find((c:any) => String(c.id) === String(s.city_id));
          if (found) s.city = found.name;
        }
      }
      const mapped: Step[] = mappedBase;
      setItems(prev => prev.map(di => di.id === deliverableId ? { ...di, steps: mapped } : di));
      const current = items.find(x => x.id === deliverableId);
      if (current) onUpdate({ ...current, steps: mapped });
    } catch (e) {
      // keep previous steps on error
      console.warn('Failed to refresh steps', e);
    }
  };

  // Load from backend
  useEffect(() => {
    const load = async () => {
      if (!projectId || !workPackageId) return;
      setLoading(true); setError(null);
      try {
        const data = await fetchDeliverables(projectId, workPackageId, projectYears.length);
        // Para cada deliverable, cargar steps
        const withSteps = await Promise.all(data.map(async d => {
          try {
            const remote = await fetchSteps(projectId, workPackageId, d.id);
            const raw = (remote || []).map((r: any) => ({
              ...r,
              profileName: profileOptions.find(p => p.id === r.profile_id)?.name || String(r.profile_id),
              countryName: countryOptions.find(c => String(c.id) === String(r.country_id))?.name || String(r.country_id),
            }));
            // Fetch cities for countries that need resolution
            const countryIdsToFetch = new Set<string>();
            for (const r of raw) {
              if ((!r.city || r.city == null) && r.city_id != null) {
                const countryObj = countryOptions.find(c => String(c.id) === String(r.country_id));
                if (countryObj) countryIdsToFetch.add(String(countryObj.id));
              }
            }
            const cityCache: Record<string, Array<{id:any;name:string}>> = {};
            for (const cid of Array.from(countryIdsToFetch)) {
              try {
                const res = await fetch(`${API_BASE}/countries/${cid}/cities`);
                cityCache[cid] = res.ok ? await res.json() : [];
              } catch { cityCache[cid] = []; }
            }
            const steps = raw.map((r:any) => {
              let cityName = r.city || null;
              if ((!cityName || cityName == null) && r.city_id != null) {
                const cid = String(r.country_id);
                const list = cityCache[cid] || [];
                const found = list.find((c:any) => String(c.id) === String(r.city_id));
                if (found) cityName = found.name;
              }
              return {
                id: r.id,
                name: r.nombre,
                profile: r.profileName,
                country: r.countryName,
                city: cityName,
                city_id: r.city_id ?? null,
                processTime: r.process_time,
                units: r.unit,
                office: (r.office ? 'Yes' : 'No') as Step['office'],
                mngPercent: r.mng,
                licenses: [],
              } as Step;
            });
            return { ...d, steps };
          } catch {
            return { ...d, steps: [] };
          }
        }));
  setItems(withSteps);
  onLoadedCount?.(withSteps.length);
      } catch (e:any) {
        setError(e.message || 'Error');
      } finally { setLoading(false); }
    };
    load();
  }, [projectId, workPackageId, projectYears.length, reloadToken, profileOptions, countryOptions]);

  useEffect(() => {
    if (createNew) {
      (async () => {
        const base = { yearlyQuantities: new Array(projectYears.length).fill(1) } as any;
        try {
          if (projectId) {
            const res = await fetch(`${API_BASE}/projects/${projectId}`);
            if (res.ok) {
              const pj = await res.json();
              // project stores margin_goal in snake_case
              base.dm = (pj.margin_goal !== undefined && pj.margin_goal !== null) ? Number(pj.margin_goal) : 0;
            } else {
              base.dm = 0;
            }
          } else {
            base.dm = 0;
          }
        } catch {
          base.dm = 0;
        }
        setEditingDeliverable(base);
      })();
    }
  }, [createNew, projectYears.length]);

  const yearCount = projectYears.length; // >0
  const isScrollableYears = yearCount > 5;

  const handleSave = async () => {
    if (!editingDeliverable) return;
    const code = editingDeliverable.code?.trim();
    const name = editingDeliverable.name?.trim();
  const marginGoalVal = editingDeliverable.dm ?? 0;
    if (!code) { setFormError('Código obligatorio'); return; }
    if (!name) { setFormError('Nombre obligatorio'); return; }
    if (isNaN(Number(marginGoalVal))) { setFormError('Margin Goal numérico obligatorio'); return; }
    setFormError(null);
    if (!projectId || !workPackageId) return;
    if (!editingDeliverable.id) {
      const created = await createDeliverableApi(projectId, workPackageId, {
        codigo: editingDeliverable.code || '',
        nombre: editingDeliverable.name || '',
  margin_goal: Number(editingDeliverable.dm || 0),
        yearlyQuantities: editingDeliverable.yearlyQuantities || new Array(projectYears.length).fill(1)
      }).catch(e => { if (e.message === 'DUPLICATE_CODE') { setFormError('Código duplicado'); return null; } throw e; });
      if (created) {
        const newList = [created, ...items];
        setItems(newList);
        onLoadedCount?.(newList.length);
        onAdd(created);
      } else { return; }
    } else {
  const updated = await updateDeliverableApi(projectId, workPackageId, editingDeliverable.id as number, {
    codigo: editingDeliverable.code,
    nombre: editingDeliverable.name,
  margin_goal: Number(editingDeliverable.dm || 0),
    yearlyQuantities: editingDeliverable.yearlyQuantities
  }).catch(e => { if (e.message === 'DUPLICATE_CODE') { setFormError('Código duplicado'); return null; } throw e; });
      if (updated) { setItems(prev => prev.map(i => i.id === updated.id ? updated : i)); onUpdate(updated); } else { return; }
    }
    setEditingDeliverable(null);
  };

  const handleCancel = () => {
    setEditingDeliverable(null);
    onCancelCreate?.();
  };

  const handleAddStep = (deliverableId: number) => {
    setExpandedDeliverable(deliverableId);
    setCreatingStepFor(deliverableId);
  };

  return (
  <div className={`deliverables-table-wrapper ${isScrollableYears ? 'scroll' : ''}`}>
      <table className="table deliverables-table">
        <colgroup>
          <col style={{ width: '7%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '39%' }} />
          <col style={{ width: '24%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Margin Goal</th>
            <th>Cantidades anuales</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={5} style={{ textAlign:'center', fontSize:'.8rem' }}>Cargando deliverables...</td></tr>
          )}
          {error && (
            <tr><td colSpan={5} style={{ textAlign:'center', color:'red', fontSize:'.8rem' }}>{error}</td></tr>
          )}
          {items.map(d => (
            <React.Fragment key={d.id}>
              <tr
                className={`deliverable-main-row ${editingDeliverable?.id === d.id ? 'new-row' : ''} ${expandedDeliverable === d.id ? 'expanded' : ''}`}
              >
                <td className="tight-cell" style={{ width: '7%' }}>
                  {editingDeliverable?.id === d.id ? (
                    <input
                      value={editingDeliverable.code || ''}
                      onChange={e => setEditingDeliverable({ ...editingDeliverable, code: e.target.value })}
                      className="wp-input"
                      placeholder="Code"
                    />
                  ) : (
                    d.code || '-'
                  )}
                </td>
                <td className="tight-cell" style={{ width: '23%' }}>
                  {editingDeliverable?.id === d.id ? (
                    <input
                      value={editingDeliverable.name || ''}
                      onChange={e => setEditingDeliverable({ ...editingDeliverable, name: e.target.value })}
                      className="wp-input"
                    />
                  ) : (
                    d.name
                  )}
                </td>
                <td className="tight-cell" style={{ width: '7%' }}>
                  {editingDeliverable?.id === d.id ? (
                    <input
                      type="number"
                      value={editingDeliverable.dm || 0}
                      onChange={e => setEditingDeliverable({ ...editingDeliverable, dm: Number(e.target.value) })}
                      className="wp-input"
                    />
                  ) : (
                    `${d.dm ?? 0}%`
                  )}
                </td>
                <td className="years-cell" style={{ width: '39%' }}>
                  <div className={`years-wrapper ${isScrollableYears ? 'scroll' : ''}`}>
                    {projectYears.map((year, idx) => (
                      <div
                        key={year}
                        className="year-item"
                        style={isScrollableYears ? undefined : { flexBasis: `${100 / yearCount}%` }}
                      >
                        <span className="year-label">{year}</span>
                        {editingDeliverable?.id === d.id ? (
                          <input
                            type="number"
                            value={editingDeliverable.yearlyQuantities?.[idx] ?? 0}
                            onChange={e => {
                              const updated = [...(editingDeliverable.yearlyQuantities || [])];
                              updated[idx] = Number(e.target.value);
                              setEditingDeliverable({ ...editingDeliverable, yearlyQuantities: updated });
                            }}
                            className="wp-input"
                          />
                        ) : (
                          <span className="year-value">{d.yearlyQuantities?.[idx] ?? 0}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="deliverable-actions actions-col" style={{ width: '24%' }}>
          {editingDeliverable?.id === d.id ? (
                    <>
                      <Button variant="success" size="sm" onClick={handleSave}>
                        Save
                      </Button>
                      <Button variant="secondary" size="sm" onClick={handleCancel}>
                        Cancel
                      </Button>
            {formError && <span className="error-tip" data-tip={formError}>!</span>}
                    </>
                  ) : (
                    <>
                      <Button variant="primary" size="sm" onClick={() => setEditingDeliverable({ ...d })}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={async () => {
                        if(!projectId||!workPackageId) return;
                        await deleteDeliverableApi(projectId, workPackageId, d.id);
                        const updated = items.filter(x=>x.id!==d.id);
                        setItems(updated);
                        onLoadedCount?.(updated.length);
                        onDelete(d.id);
                      }}>
                        Delete
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpandedDeliverable(expandedDeliverable === d.id ? null : d.id)}
                      >
                        {expandedDeliverable === d.id ? `▲ ${d.steps.length}` : `▼ ${d.steps.length}`}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAddStep(d.id)}
                        disabled={creatingStepFor === d.id}
                      >
                        + Step
                      </Button>
                    </>
                  )}
                </td>
              </tr>
              {expandedDeliverable === d.id && (
                <tr className="steps-row">
                  <td colSpan={5}>
                    <div className="deliverable-steps-panel">
                      <div className="steps-panel-header">
                        <span className="steps-badge"> {d.name} Steps ({d.steps.length})</span>
                      </div>
                      <StepsTable
                        projectId={projectId!}
                        workPackageId={workPackageId!}
                        deliverableId={d.id}
                        steps={d.steps}
                        countryOptionsRaw={countryOptions}
                        onAdd={async (s: Step) => {
                          if (!projectId || !workPackageId) return;
                          try {
                            const profileId = profileOptions.find(p => p.name === s.profile)?.id;
                            const countryId = countryOptions.find(c => c.name === s.country)?.id;
                            const cityId = (s as any).city_id ?? null;
                            if (!profileId || !countryId) throw new Error('INVALID_SELECTION');
                            const created = await createStepApi(projectId, workPackageId, d.id, {
                              profile_id: Number(profileId),
                              country_id: Number(countryId),
                              city_id: cityId ? Number(cityId) : undefined,
                              nombre: s.name,
                              process_time: s.processTime,
                              unit: s.units,
                              // office/hardware default to Yes in backend; we don't send them from create form
                            });
                            const profileName = profileOptions.find(p => p.id === created.profile_id)?.name || String(created.profile_id);
                            const countryName = countryOptions.find(c => String(c.id) === String(created.country_id))?.name || String(created.country_id);
                            d.steps.push({
                              id: created.id,
                              name: created.nombre,
                              profile: profileName,
                              country: countryName,
                              city: created.city || null,
                              city_id: created.city_id ?? null,
                              processTime: created.process_time,
                              units: created.unit,
                              office: created.office ? 'Yes' : 'No',
                              mngPercent: created.mng,
                              licenses: [],
                              hardware: (created.hardware ? 'Yes' : 'No'),
                              year: created.year ?? null,
                            });
                            onUpdate({ ...d });
                            await refreshDeliverableSteps(d.id);
                          } catch (e: any) {
                            const msg = e.message === 'DUPLICATE_STEP' ? 'Step duplicado' : (e.message === 'INVALID_SELECTION' ? 'Selecciona perfil y país válidos' : 'Error creando step');
                            alert(msg);
                          }
                          setCreatingStepFor(null);
                        }}
                        onUpdate={async (s: Step) => {
                          if (!projectId || !workPackageId) return;
                          try {
                            const profileId = profileOptions.find(p => p.name === s.profile)?.id;
                            const countryId = countryOptions.find(c => c.name === s.country)?.id;
                            if (!profileId || !countryId) throw new Error('INVALID_SELECTION');
                            const updatedRemote = await updateStepApi(projectId, workPackageId, d.id, s.id, {
                              profile_id: Number(profileId),
                              country_id: Number(countryId),
                              city_id: (s as any).city_id ?? undefined,
                              nombre: s.name,
                              process_time: s.processTime,
                              unit: s.units,
                              office: s.office === 'Yes',
                              mng: s.mngPercent,
                              hardware: (s.hardware || 'No') === 'Yes',
                            });
                            const profileName = profileOptions.find(p => p.id === updatedRemote.profile_id)?.name || String(updatedRemote.profile_id);
                            const countryName = countryOptions.find(c => String(c.id) === String(updatedRemote.country_id))?.name || String(updatedRemote.country_id);
                            const updated = d.steps.map(x => (x.id === s.id ? {
                              id: updatedRemote.id,
                              name: updatedRemote.nombre,
                              profile: profileName,
                              country: countryName,
                              city: updatedRemote.city || null,
                              city_id: updatedRemote.city_id ?? null,
                              processTime: updatedRemote.process_time,
                              units: updatedRemote.unit,
                              office: (updatedRemote.office ? 'Yes' : 'No') as Step['office'],
                              mngPercent: updatedRemote.mng,
                              licenses: x.licenses || [],
                              hardware: (updatedRemote.hardware ? 'Yes' : 'No') as 'Yes' | 'No',
                              year: updatedRemote.year ?? null,
                            } : x));
                            onUpdate({ ...d, steps: updated });
                            await refreshDeliverableSteps(d.id);
                          } catch (e: any) {
                            const msg = e.message === 'DUPLICATE_STEP' ? 'Step duplicado' : (e.message === 'INVALID_SELECTION' ? 'Selecciona perfil y país válidos' : 'Error actualizando step');
                            alert(msg);
                          }
            }}
            onDelete={async (id: number) => {
                          if (!projectId || !workPackageId) return;
                          try {
                            await deleteStepApi(projectId, workPackageId, d.id, id);
                            const updated = d.steps.filter(x => x.id !== id);
              onUpdate({ ...d, steps: updated });
              await refreshDeliverableSteps(d.id);
                          } catch {
                            alert('Error eliminando step');
                          }
            }}
            profiles={profileOptions.map(p => p.name)}
            countries={countryOptions.map(c => c.name)}
            projectYears={projectYears}
            createNew={creatingStepFor === d.id}
            onCancelCreate={() => setCreatingStepFor(null)}
                      />
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {editingDeliverable && !editingDeliverable.id && (
            <tr className="new-row">
              <td className="tight-cell" style={{ width: '7%' }}>
                <input
                  value={editingDeliverable.code || ''}
                  onChange={e => setEditingDeliverable({ ...editingDeliverable, code: e.target.value })}
                  className="wp-input"
                  placeholder="Código"
                />
              </td>
              <td className="tight-cell" style={{ width: '23%' }}>
                <input
                  value={editingDeliverable.name || ''}
                  onChange={e => setEditingDeliverable({ ...editingDeliverable, name: e.target.value })}
                  className="wp-input"
                />
              </td>
              <td className="tight-cell" style={{ width: '7%' }}>
                <input
                  type="number"
                  value={editingDeliverable.dm || 0}
                  onChange={e => setEditingDeliverable({ ...editingDeliverable, dm: Number(e.target.value) })}
                  className="wp-input"
                />
              </td>
              <td className="years-cell" style={{ width: '39%' }}>
                <div className={`years-wrapper ${isScrollableYears ? 'scroll' : ''}`}>
                  {projectYears.map((year, idx) => (
                    <div
                      key={year}
                      className="year-item"
                      style={isScrollableYears ? undefined : { flexBasis: `${100 / yearCount}%` }}
                    >
                      <span className="year-label">{year}</span>
                      <input
                        type="number"
                        value={editingDeliverable.yearlyQuantities?.[idx] ?? 0}
                        onChange={e => {
                          const updated = [...(editingDeliverable.yearlyQuantities || [])];
                          updated[idx] = Number(e.target.value);
                          setEditingDeliverable({ ...editingDeliverable, yearlyQuantities: updated });
                        }}
                        className="wp-input"
                      />
                    </div>
                  ))}
                </div>
              </td>
              <td className="deliverable-actions actions-col" style={{ width: '24%' }}>
                <Button variant="success" size="sm" onClick={handleSave}>Guardar</Button>
                <Button variant="secondary" size="sm" onClick={handleCancel}>Cancelar</Button>
                {formError && <span className="error-tip" data-tip={formError}>!</span>}
              </td>
            </tr>
          )}
          {formError && (
            <tr><td colSpan={5} style={{ color:'#d9534f', fontSize:'.7rem', textAlign:'center' }}>
              <strong>Error:</strong> {formError}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DeliverablesTable;