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
    <table className="table work-packages-table">
      <thead>
        <tr>
          <th style={{ width: '65%' }}>Nombre</th>
          <th style={{ width: '35%' }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {data.map((wp) => (
          <React.Fragment key={wp.id}>
            {/* Fila principal del WP */}
            <tr className={editingWP?.id === wp.id ? 'new-row' : ''}>
              <td>
                {editingWP?.id === wp.id ? (
                  <input
                    value={editingWP.name || ''}
                    onChange={(e) =>
                      setEditingWP({ ...editingWP, name: e.target.value })
                    }
                    className="wp-input"
                  />
                ) : (
                  wp.name
                )}
              </td>
              <td className="table-row-actions">
                {editingWP?.id === wp.id ? (
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
                      onClick={() => setEditingWP({ ...wp })}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(wp.id)}
                    >
                      Eliminar
                    </Button>

                    {/* Botón de expandir Deliverables */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setExpandedWP(expandedWP === wp.id ? null : wp.id)
                      }
                    >
                      {expandedWP === wp.id
                        ? `▲ ${wp.deliverables.length}`
                        : `▼ ${wp.deliverables.length}`}
                    </Button>

                    {/* ✅ Botón siempre visible para añadir Deliverable */}
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
              </td>
            </tr>

            {/* Fila expandida con DeliverablesTable */}
            {expandedWP === wp.id && (
              <tr className="deliverables-row">
                <td colSpan={2}>
                  <DeliverablesTable
                    deliverables={wp.deliverables}
                    onAdd={(d: Deliverable) => {
                      wp.deliverables.push(d);
                      onUpdate({ ...wp });
                      setCreatingDeliverable(null); // Ocultar fila editable tras añadir
                    }}
                    onUpdate={(d: Deliverable) => {
                      const updated = wp.deliverables.map((x) =>
                        x.id === d.id ? d : x
                      );
                      onUpdate({ ...wp, deliverables: updated });
                    }}
                    onDelete={(id: number) => {
                      const updated = wp.deliverables.filter((x) => x.id !== id);
                      onUpdate({ ...wp, deliverables: updated });
                    }}
                    projectYears={projectYears}
                    createNew={creatingDeliverable === wp.id}
                    onCancelCreate={() => setCreatingDeliverable(null)}
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}

        {/* Fila editable para nuevo WP */}
        {editingWP && !editingWP.id && (
          <tr className="new-row">
            <td>
              <input
                value={editingWP.name || ''}
                onChange={(e) =>
                  setEditingWP({ ...editingWP, name: e.target.value })
                }
                className="wp-input"
              />
            </td>
            <td className="table-row-actions">
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

export default WorkPackagesTable;

