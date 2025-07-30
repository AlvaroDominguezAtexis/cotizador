// src/components/costs/ITCosts.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useProject } from '../../hooks/useProject';
import { ITCost } from '../../types/costs';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { CostTable } from './CostTable';
import './Costs.css';

export const ITCosts: React.FC = () => {
  const {
    itCosts,
    addITCost,
    updateITCost,
    deleteITCost
  } = useProject();

  const [tableData, setTableData] = useState<ITCost[]>(itCosts);
  const [editingCost, setEditingCost] = useState<Partial<ITCost> | null>(null);

  // Añadir nueva fila editable
  const handleAddNewCost = useCallback(() => {
    const newCost: ITCost = {
      id: Date.now(),
      type: '',
      name: '',
      unitCost: 0,
      quantity: 1,
      refactorable: false
    };
    setTableData(prev => [...prev, newCost]);
    setEditingCost(newCost);
  }, []);

  // Editar coste existente
  const handleEditCost = useCallback((cost: ITCost) => {
    setEditingCost({ ...cost });
  }, []);

  // Guardar coste (nuevo o editado)
  const handleSaveCost = useCallback(() => {
    if (!editingCost || !editingCost.name?.trim()) {
      alert('El nombre del recurso IT es obligatorio');
      return;
    }

    const exists = tableData.some(c => c.id === editingCost.id);
    if (!exists) {
      addITCost(editingCost as ITCost);
      setTableData(prev => [...prev, editingCost as ITCost]);
    } else {
      updateITCost(editingCost.id!, editingCost as ITCost);
      setTableData(prev =>
        prev.map(c => (c.id === editingCost.id ? (editingCost as ITCost) : c))
      );
    }

    setEditingCost(null);
  }, [editingCost, tableData, addITCost, updateITCost]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    if (tableData.some(c => c.id === editingCost?.id && !c.name)) {
      setTableData(prev => prev.filter(c => c.id !== editingCost?.id));
    }
    setEditingCost(null);
  }, [editingCost, tableData]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'type',
        title: 'Tipo de Recurso',
        render: (value: string, record: ITCost) =>
          editingCost?.id === record.id ? (
            <select
              value={editingCost.type || ''}
              onChange={e => setEditingCost({ ...editingCost, type: e.target.value })}
              className="cost-input"
            >
              <option value="">Seleccione...</option>
              <option value="software">Software</option>
              <option value="hardware">Hardware</option>
              <option value="servicio">Servicio</option>
              <option value="licencia">Licencia</option>
              <option value="otros">Otros</option>
            </select>
          ) : (
            value || '-'
          )
      },
      {
        key: 'name',
        title: 'Nombre del Recurso',
        render: (value: string, record: ITCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost.name || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, name: e.target.value })
              }
              className="cost-input"
              placeholder="Nombre del recurso IT"
            />
          ) : (
            value
          )
      },
      {
        key: 'quantity',
        title: 'Cantidad',
        render: (value: number, record: ITCost) =>
          editingCost?.id === record.id ? (
            <input
              type="number"
              value={editingCost.quantity || 1}
              min={1}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
                  quantity: Number(e.target.value)
                })
              }
              className="cost-input"
            />
          ) : (
            value
          )
      },
      {
        key: 'unitCost',
        title: 'Coste Unitario (€)',
        render: (value: number, record: ITCost) =>
          editingCost?.id === record.id ? (
            <input
              type="number"
              value={editingCost.unitCost || 0}
              min={0}
              step={0.01}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
                  unitCost: Number(e.target.value)
                })
              }
              className="cost-input"
            />
          ) : (
            value.toLocaleString('es-ES', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          )
      },
      {
        key: 'totalCost',
        title: 'Coste Total (€)',
        render: (_: any, record: ITCost) =>
          (record.quantity * record.unitCost).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
      },
      {
        key: 'refactorable',
        title: 'Refacturable',
        render: (value: boolean, record: ITCost) =>
          editingCost?.id === record.id ? (
            <input
              type="checkbox"
              checked={editingCost.refactorable || false}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
                  refactorable: e.target.checked
                })
              }
            />
          ) : value ? (
            '✔'
          ) : (
            '✖'
          )
      },
      {
        key: 'actions',
        title: 'Acciones',
        render: (_: any, record: ITCost) =>
          editingCost?.id === record.id ? (
            <div className="table-row-actions">
              <Button variant="success" size="sm" onClick={handleSaveCost}>
                Guardar
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="table-row-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEditCost(record)}
              >
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteITCost(record.id);
                  setTableData(prev => prev.filter(c => c.id !== record.id));
                }}
              >
                Eliminar
              </Button>
            </div>
          )
      }
    ],
    [editingCost, handleSaveCost, handleCancelEdit, handleEditCost, deleteITCost]
  );

  // Estado vacío
  if (tableData.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay costes de IT"
          description="Añade tu primer coste de infraestructura IT"
          action={
            <Button variant="primary" onClick={handleAddNewCost}>
              Añadir Coste
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="costs-header">
        <Button variant="success" size="sm" onClick={handleAddNewCost}>
          + Añadir Gasto
        </Button>
      </div>

      <CostTable
        data={tableData}
        columns={columns}
        rowClassName={(record) =>
          editingCost?.id === record.id ? 'new-cost-row' : ''
        }
      />
    </Card>
  );
};

export default ITCosts;
