import React, { useState, useEffect } from 'react';
import { Step } from '../../types/workPackages';
import { Button } from '../ui/Button';
import './WorkPackages.css';
import { fetchStepAnnualData, upsertStepAnnualData, deleteStepAnnualData, AnnualData } from '../../api/stepsApi';

interface Props {
  projectId: number;
  workPackageId: number;
  deliverableId: number;
  steps: Step[];
  onAdd: (s: Step) => void;
  onUpdate: (s: Step) => void;
  onDelete: (id: number) => void;
  profiles: string[];        // nombres visibles
  countries: string[];       // nombres visibles
  createNew?: boolean;
  onCancelCreate?: () => void;
  projectYears?: number[];
}

const StepsTable: React.FC<Props> = ({
  projectId,
  workPackageId,
  deliverableId,
  steps,
  onAdd,
  onUpdate,
  onDelete,
  profiles,
  countries,
  createNew = false,
  onCancelCreate,
  projectYears
}) => {
  const [editingStep, setEditingStep] = useState<Partial<Step> | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [yearEdits, setYearEdits] = useState<Record<number, number>>({});
  const [yearMngEdits, setYearMngEdits] = useState<Record<number, number>>({});
  const [yearOfficeEdits, setYearOfficeEdits] = useState<Record<number, Step['office']>>({});
  const [yearHardwareEdits, setYearHardwareEdits] = useState<Record<number, 'Yes' | 'No'>>({});
  const [annualByStep, setAnnualByStep] = useState<Record<number, AnnualData[]>>({});

  // Helper to group steps by invariant fields across years
  const makeKey = (s: Step) => [s.name, s.profile, s.country].join('|');
  const groups = React.useMemo(() => {
    const map = new Map<string, Step[]>();
    steps.forEach(s => {
      const k = makeKey(s);
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    });
    return Array.from(map.entries()).map(([key, arr]) => {
      const items = arr.slice().sort((a, b) => (a.year || 0) - (b.year || 0));
      return { key, items, base: items[0] };
    });
  }, [steps]);

  /** Activar fila de creación */
  useEffect(() => {
    if (createNew) {
      setEditingStep({
        units: 'Hours',
  office: 'Yes',
  hardware: 'Yes',
        processTime: 0,
        mngPercent: 0
      });
    }
  }, [createNew]);

  const handleSave = async () => {
    if (!editingStep || !editingStep.name?.trim()) return;

    if (!editingStep.id) {
      const newStep: Step = {
        ...editingStep,
        id: Date.now(),
        licenses: [],
      } as Step;
      onAdd(newStep);
    } else {
      // Persist annual edits first (touched years only)
      const baseId = editingStep.id as number;
      const years = projectYears && projectYears.length > 0 ? projectYears : [];
      const existing = annualByStep[baseId] || [];
      for (const y of years) {
        const prev = existing.find(a => a.year === y);
        const touched = (y in yearEdits) || (y in yearMngEdits) || (y in yearOfficeEdits) || (y in yearHardwareEdits);
        const newPT = (y in yearEdits) ? yearEdits[y] : (prev?.process_time ?? null);
        const newMng = (y in yearMngEdits) ? yearMngEdits[y] : (prev?.mng ?? null);
        const newOffice = (y in yearOfficeEdits) ? (yearOfficeEdits[y] === 'Yes') : (prev?.office ?? null);
        const newHw = (y in yearHardwareEdits) ? (yearHardwareEdits[y] === 'Yes') : (prev?.hardware ?? null);
        const changed = prev ? (
          (prev.process_time ?? null) !== (newPT ?? null) ||
          (prev.mng ?? null) !== (newMng ?? null) ||
          (prev.office ?? null) !== (newOffice ?? null) ||
          (prev.hardware ?? null) !== (newHw ?? null)
        ) : false;
        if ((prev && changed) || (!prev && touched)) {
          await upsertStepAnnualData(projectId, workPackageId, deliverableId, baseId, y, {
            process_time: newPT ?? null,
            mng: newMng ?? null,
            office: newOffice,
            hardware: newHw,
          });
        }
      }
      // Persist base (non-annual) fields via parent
      onUpdate(editingStep as Step);
    }

    // Reset edit state and collapse
    setEditingStep(null);
    setEditingGroupKey(null);
    setExpandedKey(null);
    setYearEdits({});
    setYearMngEdits({});
    setYearOfficeEdits({});
    setYearHardwareEdits({});
  };

  const handleCancel = () => {
    setEditingStep(null);
    setEditingGroupKey(null);
    setExpandedKey(null);
    onCancelCreate?.();
  };

  return (
    <table className="table steps-table">
      <colgroup>
        <col style={{ width: '3%' }} />  {/* Expand */}
        <col style={{ width: '24%' }} /> {/* Name */}
        <col style={{ width: '20%' }} /> {/* Profile */}
        <col style={{ width: '17%' }} /> {/* Country */}
        <col style={{ width: '10%' }} /> {/* Process Time (first year) */}
        <col style={{ width: '11%' }} /> {/* Units */}
        <col style={{ width: '15%' }} /> {/* Actions */}
      </colgroup>
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th>Profile</th>
          <th>Country</th>
          <th>{(projectYears && projectYears.length > 1) ? 'Process Time (1 year)' : 'Process Time'}</th>
          <th>Units</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(({ key, items, base }) => (
          <React.Fragment key={key}>
          <tr className={editingStep?.id === base.id ? 'new-row' : ''}>
            {/* Expand/collapse arrow for multi-year rows */}
            <td className="tight-cell" style={{ textAlign: 'center' }}>
              {true ? (
                <button
                  type="button"
                  className="btn btn-link"
                  aria-label={expandedKey === key ? 'Collapse years' : 'Expand years'}
                  title={expandedKey === key ? 'Collapse years' : 'Expand years'}
                  onClick={async () => {
                    const open = expandedKey === key ? null : key;
                    setExpandedKey(open);
                    if (open) {
                      // load annual data for this step (base.id)
                      try {
                        const data = await fetchStepAnnualData(projectId, workPackageId, deliverableId, base.id);
                        setAnnualByStep(prev => ({ ...prev, [base.id]: data }));
                      } catch {
                        setAnnualByStep(prev => ({ ...prev, [base.id]: [] }));
                      }
                      setYearEdits({});
                      setYearMngEdits({});
                      setYearOfficeEdits({});
                      setYearHardwareEdits({});
                    } else {
                      setYearEdits({});
                      setYearMngEdits({});
                      setYearOfficeEdits({});
                      setYearHardwareEdits({});
                    }
                  }}
                  style={{ cursor: 'pointer', padding: 0, border: 'none', background: 'transparent', fontSize: 16 }}
                >
                  {expandedKey === key ? '▾' : '▸'}
                </button>
              ) : null}
            </td>
            <td className="tight-cell">
              {editingStep?.id === base.id ? (
                <input
                  value={editingStep.name || base.name || ''}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, name: e.target.value })
                  }
                  className="wp-input"
                />
              ) : (
                base.name
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === base.id ? (
                <select
                  value={editingStep.profile || base.profile || ''}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, profile: e.target.value })
                  }
                  className="wp-input"
                >
                  <option value="">Select Profile</option>
                  {profiles.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              ) : (
                base.profile && profiles.includes(base.profile) ? base.profile : base.profile
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === base.id ? (
                <select
                  value={editingStep.country || base.country || ''}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, country: e.target.value })
                  }
                  className="wp-input"
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                base.country && countries.includes(base.country) ? base.country : base.country
              )}
            </td>
            {/* Process Time from first project year */}
            <td className="tight-cell" style={{ textAlign: 'right' }}>
              {(() => {
                const firstYear = projectYears && projectYears.length > 0 ? projectYears[0] : undefined;
                const ann = firstYear ? (annualByStep[base.id] || []).find(a => a.year === firstYear) : undefined;
                const value = ann && ann.process_time != null ? ann.process_time : base.processTime;
                return value ?? 0;
              })()}
            </td>
            <td className="tight-cell">
              {editingStep?.id === base.id ? (
                <select
                  value={editingStep.units || base.units || 'Hours'}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, units: e.target.value as Step['units'] })
                  }
                  className="wp-input"
                >
                  <option value="Hours">Hours</option>
                  <option value="Days">Days</option>
                </select>
              ) : (
                base.units
              )}
            </td>
            {/* Removed Process Time, Office, Hardware, %Mng from main row per new spec; they are shown in expanded grid */}
            <td className="table-row-actions">
              {editingStep?.id === base.id ? (
                <>
                  <Button variant="success" size="sm" onClick={handleSave}>
                    Guardar
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleCancel}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
          <Button
                    variant="primary"
                    size="sm"
          onClick={async () => {
                      setEditingStep({ ...base });
            setEditingGroupKey(key);
                      setExpandedKey(key);
                      // ensure annual data loaded and seed maps
                      try {
                        const data = await fetchStepAnnualData(projectId, workPackageId, deliverableId, base.id);
                        setAnnualByStep(prev => ({ ...prev, [base.id]: data }));
            // don't pre-seed maps; keep controlled inputs showing current values and only persist touched fields
            setYearEdits({});
            setYearMngEdits({});
            setYearOfficeEdits({});
            setYearHardwareEdits({});
                      } catch {
                        setYearEdits({});
                        setYearMngEdits({});
                        setYearOfficeEdits({});
                        setYearHardwareEdits({});
                      }
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(base.id)}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </td>
          </tr>
          {expandedKey === key && (
            <tr>
              <td></td>
              <td colSpan={6}>
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '6px 8px' }}></th>
                        {(projectYears && projectYears.length > 0 ? projectYears : [])
                          .map(yy => (
                          <th key={`hdr-${yy}`} style={{ textAlign: 'center', padding: '6px 8px' }}>{yy}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, padding: '6px 8px' }}>Process time per year</td>
                        {(projectYears && projectYears.length > 0 ? projectYears : []).map(yy => {
                          const ann = (annualByStep[base.id] || []).find(a => a.year === yy);
                          const isEditing = editingGroupKey === key;
                          const displayVal = ann?.process_time ?? base.processTime;
                          return (
                            <td key={`pt-${yy}`} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="wp-input"
                                  value={yearEdits[yy] ?? (ann?.process_time ?? (base.processTime ?? 0))}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setYearEdits(prev => ({ ...prev, [yy]: v }));
                                  }}
                                />
                              ) : (
                                <span>{displayVal}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, padding: '6px 8px' }}>% Mng per year</td>
                        {(projectYears && projectYears.length > 0 ? projectYears : []).map(yy => {
                          const ann = (annualByStep[base.id] || []).find(a => a.year === yy);
                          const isEditing = editingGroupKey === key;
                          const displayVal = (ann?.mng ?? base.mngPercent) ?? 0;
                          return (
                            <td key={`mng-${yy}`} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="wp-input"
                                  value={yearMngEdits[yy] ?? (ann?.mng ?? (base.mngPercent ?? 0))}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setYearMngEdits(prev => ({ ...prev, [yy]: v }));
                                  }}
                                />
                              ) : (
                                <span>{displayVal}%</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, padding: '6px 8px' }}>Office per year</td>
                        {(projectYears && projectYears.length > 0 ? projectYears : []).map(yy => {
                          const ann = (annualByStep[base.id] || []).find(a => a.year === yy);
                          const isEditing = editingGroupKey === key;
                          const displayVal = (ann?.office === null || ann?.office === undefined) ? base.office : (ann?.office ? 'Yes' : 'No');
                          return (
                            <td key={`office-${yy}`} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {isEditing ? (
                                <select
                                  className="wp-input"
                                  value={yearOfficeEdits[yy] ?? ((ann?.office === null || ann?.office === undefined) ? (base.office ?? 'No') : (ann?.office ? 'Yes' : 'No'))}
                                  onChange={(e) => setYearOfficeEdits(prev => ({ ...prev, [yy]: e.target.value as Step['office'] }))}
                                >
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                </select>
                              ) : (
                                <span>{displayVal}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600, padding: '6px 8px' }}>Hardware per year</td>
                        {(projectYears && projectYears.length > 0 ? projectYears : []).map(yy => {
                          const ann = (annualByStep[base.id] || []).find(a => a.year === yy);
                          const isEditing = editingGroupKey === key;
                          const displayVal = (ann?.hardware === null || ann?.hardware === undefined) ? (base.hardware || 'No') : (ann?.hardware ? 'Yes' : 'No');
                          return (
                            <td key={`hw-${yy}`} style={{ padding: '6px 8px', textAlign: 'center' }}>
                              {isEditing ? (
                                <select
                                  className="wp-input"
                                  value={yearHardwareEdits[yy] ?? ((ann?.hardware === null || ann?.hardware === undefined) ? (base.hardware || 'No') : (ann?.hardware ? 'Yes' : 'No'))}
                                  onChange={(e) => setYearHardwareEdits(prev => ({ ...prev, [yy]: e.target.value as 'Yes' | 'No' }))}
                                >
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                </select>
                              ) : (
                                <span>{displayVal}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
          {/* Per-year action row removed: only main row Save/Cancel are used */}
                    </tbody>
                  </table>
                </div>
        {/* Expanded Save/Cancel removed: save via main row buttons */}
              </td>
            </tr>
          )}
          </React.Fragment>
        ))}

        {/* Fila editable para nuevo Step */}
        {editingStep && !editingStep.id && (
          <tr className="new-row">
            <td></td>
            <td className="tight-cell">
              <input
                value={editingStep.name || ''}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, name: e.target.value })
                }
                className="wp-input"
              />
            </td>
            <td className="tight-cell">
              <select
                value={editingStep.profile || ''}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, profile: e.target.value })
                }
                className="wp-input"
              >
                <option value="">Select Profile</option>
                {profiles.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </td>
            <td className="tight-cell">
              <select
                value={editingStep.country || ''}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, country: e.target.value })
                }
                className="wp-input"
              >
                <option value="">Select Country</option>
                {countries.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </td>
            <td className="tight-cell" style={{ textAlign: 'right' }}>
              <input
                type="number"
                value={editingStep.processTime ?? 0}
                onChange={(e) => setEditingStep({ ...editingStep, processTime: Number(e.target.value) })}
                className="wp-input"
                style={{ width: 90 }}
              />
            </td>
            <td className="tight-cell">
              <select
                value={editingStep.units || 'Hours'}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, units: e.target.value as Step['units'] })
                }
                className="wp-input"
              >
                <option value="Hours">Hours</option>
                <option value="Days">Days</option>
              </select>
            </td>
            <td className="table-row-actions">
              {/* Initial annual defaults (applied to all project years on create) */}
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
                {/* %Mng now defaults from project_countries based on country; no manual entry on create */}
                {/* Office and Hardware default to Yes on create; editable later per-year */}
              </div>
              <Button variant="success" size="sm" onClick={handleSave}>
                Guardar
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default StepsTable;



