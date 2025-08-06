// src/components/costs/SubcontractCosts.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useProject } from '../../hooks/useProject';
import { SubcontractCost } from '../../types/costs';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { CostTable } from './CostTable';
import './Costs.css';

export const SubcontractCosts: React.FC = () => {
  const {
    subcontractCosts,
    addSubcontractCost,
    updateSubcontractCost,
    deleteSubcontractCost
  } = useProject();

  const [tableData, setTableData] = useState<SubcontractCost[]>(subcontractCosts);
  const [editingCost, setEditingCost] = useState<Partial<SubcontractCost> | null>(null);

  // Añadir nueva fila editable
  const handleAddNewCost = useCallback(() => {
    const newCost: SubcontractCost = {
      id: Date.now(),
      mode: '',
      provider: '',
      quantity: 1,
      unitCost: 0,
      refactorable: false
    };
    setTableData(prev => [...prev, newCost]);
    setEditingCost(newCost);
  }, []);

  // Editar coste existente
  const handleEditCost = useCallback((cost: SubcontractCost) => {
    setEditingCost({ ...cost });
  }, []);

  // Guardar coste (nuevo o editado)
  const handleSaveCost = useCallback(() => {
    if (!editingCost || !editingCost.provider?.trim()) {
      alert('El proveedor es obligatorio');
      return;
    }

    const exists = tableData.some(c => c.id === editingCost.id);
    if (!exists) {
      addSubcontractCost(editingCost as SubcontractCost);
      setTableData(prev => [...prev, editingCost as SubcontractCost]);
    } else {
      updateSubcontractCost(editingCost.id!, editingCost as SubcontractCost);
      setTableData(prev =>
        prev.map(c => (c.id === editingCost.id ? (editingCost as SubcontractCost) : c))
      );
    }

    setEditingCost(null);
  }, [editingCost, tableData, addSubcontractCost, updateSubcontractCost]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    if (tableData.some(c => c.id === editingCost?.id && !c.provider)) {
      setTableData(prev => prev.filter(c => c.id !== editingCost?.id));
    }
    setEditingCost(null);
  }, [editingCost, tableData]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'mode',
        title: 'Modo de Subcontrata',
        render: (value: string, record: SubcontractCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost.mode || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, mode: e.target.value })
              }
              className="cost-input"
              placeholder="Ej: Desarrollo, Diseño..."
            />
          ) : (
            value
          )
      },
      {
        key: 'provider',
        title: 'Proveedor',
        render: (value: string, record: SubcontractCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost.provider || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, provider: e.target.value })
              }
              className="cost-input"
              placeholder="Nombre del proveedor"
            />
          ) : (
            value
          )
      },
      {
        key: 'quantity',
        title: 'Cantidad',
        render: (value: number, record: SubcontractCost) =>
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
        render: (value: number, record: SubcontractCost) =>
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
        render: (_: any, record: SubcontractCost) =>
          (record.quantity * record.unitCost).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
      },
      {
        key: 'refactorable',
        title: 'Refacturable',
        render: (value: boolean, record: SubcontractCost) =>
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
        render: (_: any, record: SubcontractCost) =>
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
                  deleteSubcontractCost(record.id);
                  setTableData(prev => prev.filter(c => c.id !== record.id));
                }}
              >
                Eliminar
              </Button>
            </div>
          )
      }
    ],
    [editingCost, handleSaveCost, handleCancelEdit, handleEditCost, deleteSubcontractCost]
  );

  // Estado vacío
  if (tableData.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay costes de subcontrata"
          description="Añade tu primer coste de subcontrata"
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

export default SubcontractCosts;

