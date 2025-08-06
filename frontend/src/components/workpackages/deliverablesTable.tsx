import React, { useState, useEffect } from 'react';
import { Deliverable, Step } from '../../types/workPackages';
import { Button } from '../ui/Button';
import StepsTable from './StepsTable';
import './WorkPackages.css';

interface Props {
  deliverables: Deliverable[];
  onAdd: (d: Deliverable) => void;
  onUpdate: (d: Deliverable) => void;
  onDelete: (id: number) => void;
  projectYears: number[];
  profiles?: string[];       // 🔹 Ahora opcional
  countries?: string[];      // 🔹 Ahora opcional
  createNew?: boolean;
  onCancelCreate?: () => void;
}

const DeliverablesTable: React.FC<Props> = ({
  deliverables,
  onAdd,
  onUpdate,
  onDelete,
  projectYears,
  profiles = [],     // ✅ Valor por defecto
  countries = [],    // ✅ Valor por defecto
  createNew = false,
  onCancelCreate
}) => {
  const [editingDeliverable, setEditingDeliverable] = useState<Partial<Deliverable> | null>(null);
  const [expandedDeliverable, setExpandedDeliverable] = useState<number | null>(null);
  const [creatingStepFor, setCreatingStepFor] = useState<number | null>(null);

  /** Activar fila de creación cuando createNew es true */
  useEffect(() => {
    if (createNew) {
      setEditingDeliverable({
        yearlyQuantities: new Array(projectYears.length).fill(0),
      });
    }
  }, [createNew, projectYears.length]);

  const handleSave = () => {
    if (!editingDeliverable || !editingDeliverable.name?.trim()) return;

    if (!editingDeliverable.id) {
      const newDeliverable: Deliverable = {
        ...editingDeliverable,
        id: Date.now(),
        steps: [],
        yearlyQuantities:
          editingDeliverable.yearlyQuantities || new Array(projectYears.length).fill(0),
      } as Deliverable;
      onAdd(newDeliverable);
    } else {
      onUpdate(editingDeliverable as Deliverable);
    }

    setEditingDeliverable(null);
  };

  const handleCancel = () => {
    setEditingDeliverable(null);
    onCancelCreate?.();
  };

  /** Activar creación de un nuevo Step para un Deliverable */
  const handleAddStep = (deliverableId: number) => {
    setExpandedDeliverable(deliverableId); // ✅ Expande automáticamente
    setCreatingStepFor(deliverableId);
  };

  return (
    <table className="table deliverables-table">
      <thead>
        <tr>
          <th style={{ width: '30%' }}>Nombre</th>
          <th style={{ width: '10%' }}>Margen (%)</th>
          {projectYears.map((year) => (
            <th key={year} style={{ width: `${50 / projectYears.length}%` }}>
              Cantidad {year}
            </th>
          ))}
          <th style={{ width: '20%' }}>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {deliverables.map((d) => (
          <React.Fragment key={d.id}>
            <tr className={editingDeliverable?.id === d.id ? 'new-row' : ''}>
              <td>
                {editingDeliverable?.id === d.id ? (
                  <input
                    value={editingDeliverable.name || ''}
                    onChange={(e) =>
                      setEditingDeliverable({ ...editingDeliverable, name: e.target.value })
                    }
                    className="wp-input"
                  />
                ) : (
                  d.name
                )}
              </td>
              <td>
                {editingDeliverable?.id === d.id ? (
                  <input
                    type="number"
                    value={editingDeliverable.margin || 0}
                    onChange={(e) =>
                      setEditingDeliverable({ ...editingDeliverable, margin: Number(e.target.value) })
                    }
                    className="wp-input"
                  />
                ) : (
                  `${d.margin ?? 0}%`
                )}
              </td>

              {/* Columnas dinámicas de cantidad anual */}
              {projectYears.map((_, idx) => (
                <td key={idx}>
                  {editingDeliverable?.id === d.id ? (
                    <input
                      type="number"
                      value={editingDeliverable.yearlyQuantities?.[idx] ?? 0}
                      onChange={(e) => {
                        const updated = [...(editingDeliverable.yearlyQuantities || [])];
                        updated[idx] = Number(e.target.value);
                        setEditingDeliverable({ ...editingDeliverable, yearlyQuantities: updated });
                      }}
                      className="wp-input"
                    />
                  ) : (
                    d.yearlyQuantities?.[idx] ?? 0
                  )}
                </td>
              ))}

              <td className="table-row-actions">
                {editingDeliverable?.id === d.id ? (
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
                      onClick={() => setEditingDeliverable({ ...d })}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => onDelete(d.id)}
                    >
                      Eliminar
                    </Button>

                    {/* Botón de expandir Steps */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setExpandedDeliverable(expandedDeliverable === d.id ? null : d.id)
                      }
                    >
                      {expandedDeliverable === d.id
                        ? `▲ ${d.steps.length}`
                        : `▼ ${d.steps.length}`}
                    </Button>

                    {/* ✅ Botón para añadir Step */}
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

            {/* Fila expandida con StepsTable */}
            {expandedDeliverable === d.id && (
              <tr className="steps-row">
                <td colSpan={3 + projectYears.length}>
                  <StepsTable
                    steps={d.steps}
                    onAdd={(s: Step) => {
                      d.steps.push(s);
                      onUpdate({ ...d });
                      setCreatingStepFor(null); // ✅ Reset tras añadir
                    }}
                    onUpdate={(s: Step) => {
                      const updated = d.steps.map((x) => (x.id === s.id ? s : x));
                      onUpdate({ ...d, steps: updated });
                    }}
                    onDelete={(id: number) => {
                      const updated = d.steps.filter((x) => x.id !== id);
                      onUpdate({ ...d, steps: updated });
                    }}
                    createNew={creatingStepFor === d.id} // ✅ Activa fila editable en StepsTable
                    onCancelCreate={() => setCreatingStepFor(null)}
                    profiles={profiles}
                    countries={countries}
                  />
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}

        {/* Fila editable para nuevo Deliverable */}
        {editingDeliverable && !editingDeliverable.id && (
          <tr className="new-row">
            <td>
              <input
                value={editingDeliverable.name || ''}
                onChange={(e) =>
                  setEditingDeliverable({ ...editingDeliverable, name: e.target.value })
                }
                className="wp-input"
              />
            </td>
            <td>
              <input
                type="number"
                value={editingDeliverable.margin || 0}
                onChange={(e) =>
                  setEditingDeliverable({ ...editingDeliverable, margin: Number(e.target.value) })
                }
                className="wp-input"
              />
            </td>

            {projectYears.map((_, idx) => (
              <td key={idx}>
                <input
                  type="number"
                  value={editingDeliverable.yearlyQuantities?.[idx] ?? 0}
                  onChange={(e) => {
                    const updated = [...(editingDeliverable.yearlyQuantities || [])];
                    updated[idx] = Number(e.target.value);
                    setEditingDeliverable({ ...editingDeliverable, yearlyQuantities: updated });
                  }}
                  className="wp-input"
                />
              </td>
            ))}

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

export default DeliverablesTable;