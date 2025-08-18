import React, { useState, useEffect } from 'react';
import { Step } from '../../types/workPackages';
import { Button } from '../ui/Button';
import './WorkPackages.css';

interface Props {
  steps: Step[];
  onAdd: (s: Step) => void;
  onUpdate: (s: Step) => void;
  onDelete: (id: number) => void;
  profiles: string[];        // nombres visibles
  countries: string[];       // nombres visibles
  createNew?: boolean;
  onCancelCreate?: () => void;
}

const StepsTable: React.FC<Props> = ({
  steps,
  onAdd,
  onUpdate,
  onDelete,
  profiles,
  countries,
  createNew = false,
  onCancelCreate
}) => {
  const [editingStep, setEditingStep] = useState<Partial<Step> | null>(null);

  /** Activar fila de creación */
  useEffect(() => {
    if (createNew) {
      setEditingStep({
        units: 'Hours',
        office: 'No',
        processTime: 0,
        mngPercent: 0
      });
    }
  }, [createNew]);

  const handleSave = () => {
    if (!editingStep || !editingStep.name?.trim()) return;

    if (!editingStep.id) {
      const newStep: Step = {
        ...editingStep,
        id: Date.now(),
        licenses: [],
      } as Step;
      onAdd(newStep);
    } else {
      onUpdate(editingStep as Step);
    }

    setEditingStep(null);
  };

  const handleCancel = () => {
    setEditingStep(null);
    onCancelCreate?.();
  };

  return (
    <table className="table steps-table">
      <colgroup>
        <col style={{ width: '22%' }} /> {/* Name */}
        <col style={{ width: '20%' }} /> {/* Profile */}
        <col style={{ width: '14%' }} /> {/* Country */}
        <col style={{ width: '6%' }} /> {/* Process Time */}
        <col style={{ width: '8%' }} />  {/* Units */}
        <col style={{ width: '6%' }} />  {/* Office */}
        <col style={{ width: '6%' }} />  {/* % Mng */}
        <col style={{ width: '18%' }} /> {/* Actions */}
      </colgroup>
      <thead>
        <tr>
          <th>Name</th>
          <th>Profile</th>
          <th>Country</th>
          <th>Process Time</th>
          <th>Units</th>
          <th>Office</th>
          <th>% Mng</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((s) => (
          <tr key={s.id} className={editingStep?.id === s.id ? 'new-row' : ''}>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
                <input
                  value={editingStep.name || ''}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, name: e.target.value })
                  }
                  className="wp-input"
                />
              ) : (
                s.name
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
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
              ) : (
                s.profile && profiles.includes(s.profile) ? s.profile : s.profile
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
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
              ) : (
                s.country && countries.includes(s.country) ? s.country : s.country
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
                <input
                  type="number"
                  value={editingStep.processTime ?? 0}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, processTime: Number(e.target.value) })
                  }
                  className="wp-input"
                />
              ) : (
                s.processTime
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
                <select
                  value={editingStep.units || 'Hours'}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, units: e.target.value as Step['units'] })
                  }
                  className="wp-input"
                >
                  <option value="Hours">Hours</option>
                  <option value="Days">Days</option>
                  <option value="Months">Months</option>
                </select>
              ) : (
                s.units
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
                <select
                  value={editingStep.office || 'No'}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, office: e.target.value as Step['office'] })
                  }
                  className="wp-input"
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                s.office
              )}
            </td>
            <td className="tight-cell">
              {editingStep?.id === s.id ? (
                <input
                  type="number"
                  value={editingStep.mngPercent ?? 0}
                  onChange={(e) =>
                    setEditingStep({ ...editingStep, mngPercent: Number(e.target.value) })
                  }
                  className="wp-input"
                />
              ) : (
                `${s.mngPercent}%`
              )}
            </td>
            <td className="table-row-actions">
              {editingStep?.id === s.id ? (
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
                    onClick={() => setEditingStep({ ...s })}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDelete(s.id)}
                  >
                    Eliminar
                  </Button>
                </>
              )}
            </td>
          </tr>
        ))}

        {/* Fila editable para nuevo Step */}
        {editingStep && !editingStep.id && (
          <tr className="new-row">
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
            <td className="tight-cell">
              <input
                type="number"
                value={editingStep.processTime ?? 0}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, processTime: Number(e.target.value) })
                }
                className="wp-input"
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
                <option value="Months">Months</option>
              </select>
            </td>
            <td className="tight-cell">
              <select
                value={editingStep.office || 'No'}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, office: e.target.value as Step['office'] })
                }
                className="wp-input"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </td>
            <td className="tight-cell">
              <input
                type="number"
                value={editingStep.mngPercent ?? 0}
                onChange={(e) =>
                  setEditingStep({ ...editingStep, mngPercent: Number(e.target.value) })
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

export default StepsTable;



