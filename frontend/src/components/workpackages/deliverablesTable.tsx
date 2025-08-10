import React, { useState, useEffect } from 'react';
import { Deliverable, Step } from '../../types/workPackages';
import { Button } from '../ui/Button';
import StepsTable from './StepsTable';
import './WorkPackages.css';
import { createDeliverableApi, updateDeliverableApi, deleteDeliverableApi, fetchDeliverables } from '../../api/deliverablesApi';

interface Props {
  deliverables: Deliverable[]; // initial fallback list (will be overridden by backend fetch)
  onAdd: (d: Deliverable) => void; // kept for upward sync/backward compat
  onUpdate: (d: Deliverable) => void;
  onDelete: (id: number) => void;
  projectYears: number[]; // siempre >= 1
  profiles?: string[];
  countries?: string[];
  createNew?: boolean;
  onCancelCreate?: () => void;
  projectId?: number | null;
  workPackageId?: number | null;
}

const DeliverablesTable: React.FC<Props> = ({
  deliverables,
  onAdd,
  onUpdate,
  onDelete,
  projectYears,
  profiles = [],
  countries = [],
  createNew = false,
  onCancelCreate,
  projectId,
  workPackageId
}) => {
  const [editingDeliverable, setEditingDeliverable] = useState<Partial<Deliverable> | null>(null);
  const [expandedDeliverable, setExpandedDeliverable] = useState<number | null>(null);
  const [creatingStepFor, setCreatingStepFor] = useState<number | null>(null);
  const [items, setItems] = useState<Deliverable[]>(deliverables || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Load from backend
  useEffect(() => {
    const load = async () => {
      if (!projectId || !workPackageId) return;
      setLoading(true); setError(null);
      try {
        const data = await fetchDeliverables(projectId, workPackageId, projectYears.length);
        setItems(data);
      } catch (e:any) {
        setError(e.message || 'Error');
      } finally { setLoading(false); }
    };
    load();
  }, [projectId, workPackageId, projectYears.length, reloadToken]);

  useEffect(() => {
    if (createNew) setEditingDeliverable({ yearlyQuantities: new Array(projectYears.length).fill(0) });
  }, [createNew, projectYears.length]);

  const yearCount = projectYears.length; // >0
  const isScrollableYears = yearCount > 5;

  const handleSave = async () => {
    if (!editingDeliverable) return;
    const code = editingDeliverable.code?.trim();
    const name = editingDeliverable.name?.trim();
  const dmVal = editingDeliverable.dm ?? 0;
    if (!code) { setFormError('Código obligatorio'); return; }
    if (!name) { setFormError('Nombre obligatorio'); return; }
    if (isNaN(Number(dmVal))) { setFormError('DM numérico obligatorio'); return; }
    setFormError(null);
    if (!projectId || !workPackageId) return;
    if (!editingDeliverable.id) {
      const created = await createDeliverableApi(projectId, workPackageId, {
        codigo: editingDeliverable.code || '',
        nombre: editingDeliverable.name || '',
  dm: Number(editingDeliverable.dm || 0),
        yearlyQuantities: editingDeliverable.yearlyQuantities || new Array(projectYears.length).fill(0)
      }).catch(e => { if (e.message === 'DUPLICATE_CODE') { setFormError('Código duplicado'); return null; } throw e; });
      if (created) { setItems(prev => [created, ...prev]); onAdd(created); } else { return; }
    } else {
      const updated = await updateDeliverableApi(projectId, workPackageId, editingDeliverable.id as number, {
        codigo: editingDeliverable.code,
        nombre: editingDeliverable.name,
  dm: Number(editingDeliverable.dm || 0),
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
            <th>DM</th>
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
                      <Button variant="danger" size="sm" onClick={async () => { if(!projectId||!workPackageId) return; await deleteDeliverableApi(projectId, workPackageId, d.id); setItems(prev=>prev.filter(x=>x.id!==d.id)); onDelete(d.id); }}>
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
                        steps={d.steps}
                        onAdd={(s: Step) => {
                          d.steps.push(s);
                          onUpdate({ ...d });
                          setCreatingStepFor(null);
                        }}
                        onUpdate={(s: Step) => {
                          const updated = d.steps.map(x => (x.id === s.id ? s : x));
                          onUpdate({ ...d, steps: updated });
                        }}
                        onDelete={(id: number) => {
                          const updated = d.steps.filter(x => x.id !== id);
                          onUpdate({ ...d, steps: updated });
                        }}
                        createNew={creatingStepFor === d.id}
                        onCancelCreate={() => setCreatingStepFor(null)}
                        profiles={profiles}
                        countries={countries}
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