import React, { useEffect, useState } from 'react';
import { WorkPackage, Deliverable } from '../../types/workPackages';
import { Button } from '../ui/Button';
import DeliverablesTable from './deliverablesTable';
import './WorkPackages.css';

interface Props {
  data: WorkPackage[];
  onAdd: (wp: WorkPackage) => void;
  onUpdate: (wp: WorkPackage) => void;
  onDelete: (id: number) => void;
  createNew?: boolean;
  onCancelCreate?: () => void;
  projectYears?: number[];
}

const WorkPackagesTable: React.FC<Props> = ({
  data,
  onAdd,
  onUpdate,
  onDelete,
  createNew = false,
  onCancelCreate,
  projectYears = [],
}) => {
  const [editingWP, setEditingWP] = useState<Partial<WorkPackage> | null>(null);
  const [expandedWP, setExpandedWP] = useState<number | null>(null);
  const [creatingDeliverable, setCreatingDeliverable] = useState<number | null>(null);

  /** Activar fila de creación de WP */
  useEffect(() => {
    if (createNew) setEditingWP({});
  }, [createNew]);

  const handleSave = () => {
    if (!editingWP || !editingWP.name?.trim()) return;

    if (!editingWP.id) {
      const newWP: WorkPackage = {
        ...editingWP,
        id: Date.now(),
        deliverables: [],
      } as WorkPackage;
      onAdd(newWP);
    } else {
      onUpdate(editingWP as WorkPackage);
    }

    setEditingWP(null);
  };

  const handleCancel = () => {
    setEditingWP(null);
    onCancelCreate?.();
  };

  const handleAddDeliverable = (wpId: number) => {
    setCreatingDeliverable(wpId);
    setExpandedWP(wpId); // ✅ Se expande automáticamente al crear un Deliverable
  };

  return (
    <div className="work-packages-list">
      {/* Card para nuevo WP */}
      {editingWP && !editingWP.id && (
        <div className="work-package-card new-card">
          <div className="wp-header-grid">
            <div className="wp-field code">
              <label>WP Code</label>
              <input
                value={editingWP.code || ''}
                onChange={(e) => setEditingWP({ ...editingWP, code: e.target.value })}
                className="wp-input"
                placeholder="Código"
              />
            </div>
            <div className="wp-field name">
              <label>Workpackage Name</label>
              <input
                value={editingWP.name || ''}
                onChange={(e) => setEditingWP({ ...editingWP, name: e.target.value })}
                className="wp-input"
              />
            </div>
            <div className="wp-field dm">
              <label>DM</label>
              <div className="dm-inline">
                <input
                  value={editingWP.DM || ''}
                  onChange={(e) => setEditingWP({ ...editingWP, DM: e.target.value })}
                  placeholder="DM"
                  className="wp-input"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  title="Cascadear DM (no hay deliverables aún)"
                  disabled
                >
                  ⇨
                </Button>
              </div>
            </div>
            <div className="wp-field actions-field">
              <label>Actions</label>
              <div className="wp-actions-buttons">
                <Button variant="success" size="sm" onClick={handleSave}>Save</Button>
                <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {data.map(wp => {
        const isEditing = editingWP?.id === wp.id;
        const isExpanded = expandedWP === wp.id;
        return (
          <div key={wp.id} className={`work-package-card ${isEditing ? 'editing' : ''}`}>
            <div className="wp-header-grid">
              <div className="wp-field code">
                <label>WP Code</label>
                {isEditing ? (
                  <input
                    value={editingWP?.code || ''}
                    onChange={e => setEditingWP({ ...editingWP!, code: e.target.value })}
                    className="wp-input"
                    placeholder="Code"
                  />
                ) : (
                  <div className="wp-static-value">{wp.code || '-'}</div>
                )}
              </div>
              <div className="wp-field name">
                <label>Workpackage Name</label>
                {isEditing ? (
                  <input
                    value={editingWP?.name || ''}
                    onChange={e => setEditingWP({ ...editingWP!, name: e.target.value })}
                    className="wp-input"
                  />
                ) : (
                  <div className="wp-static-value">{wp.name}</div>
                )}
              </div>
              <div className="wp-field dm">
                <label>DM</label>
                <div className="dm-inline">
                  {isEditing ? (
                    <input
                      value={editingWP?.DM || ''}
                      onChange={e => setEditingWP({ ...editingWP!, DM: e.target.value })}
                      placeholder="DM"
                      className="wp-input"
                    />
                  ) : (
                    <div className="wp-static-value">{wp.DM || '-'}</div>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    title="Cascadear DM a todos los deliverables"
                    onClick={() => {
                      const dmValue = (isEditing ? editingWP?.DM : wp.DM) || '';
                      if (!dmValue) {
                        alert('Primero introduce un DM para el Work Package.');
                        return;
                      }
                      const updatedDeliverables: Deliverable[] = wp.deliverables.map(d => ({ ...d, DM: dmValue }));
                      const updatedWP: WorkPackage = { ...wp, DM: dmValue, deliverables: updatedDeliverables } as WorkPackage;
                      if (isEditing) setEditingWP({ ...editingWP!, DM: dmValue });
                      onUpdate(updatedWP);
                    }}
                  >
                    ⇨
                  </Button>
                </div>
              </div>
              <div className="wp-field actions-field">
                <label>Actions</label>
                <div className="wp-actions-buttons">
                  {isEditing ? (
                    <>
                      <Button variant="success" size="sm" onClick={handleSave}>Save</Button>
                      <Button variant="secondary" size="sm" onClick={handleCancel}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="primary" size="sm" onClick={() => setEditingWP({ ...wp })}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => onDelete(wp.id)}>Delete</Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpandedWP(isExpanded ? null : wp.id)}
                      >
                        {isExpanded ? `▲ ${wp.deliverables.length}` : `▼ ${wp.deliverables.length}`}
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleAddDeliverable(wp.id)}
                        disabled={creatingDeliverable === wp.id}
                      >
                        + Deliverable
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {isExpanded && (
              <div className="wp-deliverables-block">
                <DeliverablesTable
                  deliverables={wp.deliverables}
                  onAdd={(d: Deliverable) => {
                    wp.deliverables.push(d);
                    onUpdate({ ...wp });
                    setCreatingDeliverable(null);
                  }}
                  onUpdate={(d: Deliverable) => {
                    const updated = wp.deliverables.map(x => x.id === d.id ? d : x);
                    onUpdate({ ...wp, deliverables: updated });
                  }}
                  onDelete={(id: number) => {
                    const updated = wp.deliverables.filter(x => x.id !== id);
                    onUpdate({ ...wp, deliverables: updated });
                  }}
                  projectYears={projectYears}
                  createNew={creatingDeliverable === wp.id}
                  onCancelCreate={() => setCreatingDeliverable(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WorkPackagesTable;

