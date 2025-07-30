// src/components/costs/OtherCosts.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useProject } from '../../hooks/useProject';
import { OtherCost } from '../../types/costs';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { CostTable } from './CostTable';
import './Costs.css';

export const OtherCosts: React.FC = () => {
  const {
    otherCosts,
    addOtherCost,
    updateOtherCost,
    deleteOtherCost
  } = useProject();

  const [tableData, setTableData] = useState<OtherCost[]>(otherCosts);
  const [editingCost, setEditingCost] = useState<Partial<OtherCost> | null>(null);

  // Añadir nueva fila editable
  const handleAddNewCost = useCallback(() => {
    const newCost: OtherCost = {
      id: Date.now(),
      concept: '',
      unitCost: 0,
      quantity: 1,
      refactorable: false
    };
    setTableData(prev => [...prev, newCost]);
    setEditingCost(newCost);
  }, []);

  // Editar coste existente
  const handleEditCost = useCallback((cost: OtherCost) => {
    setEditingCost({ ...cost });
  }, []);

  // Guardar coste (nuevo o editado)
  const handleSaveCost = useCallback(() => {
    if (!editingCost || !editingCost.concept?.trim()) {
      alert('El concepto es obligatorio');
      return;
    }

    const exists = tableData.some(c => c.id === editingCost.id);
    if (!exists) {
      addOtherCost(editingCost as OtherCost);
      setTableData(prev => [...prev, editingCost as OtherCost]);
    } else {
      updateOtherCost(editingCost.id!, editingCost as OtherCost);
      setTableData(prev =>
        prev.map(c => (c.id === editingCost.id ? (editingCost as OtherCost) : c))
      );
    }

    setEditingCost(null);
  }, [editingCost, tableData, addOtherCost, updateOtherCost]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    if (tableData.some(c => c.id === editingCost?.id && !c.concept)) {
      setTableData(prev => prev.filter(c => c.id !== editingCost?.id));
    }
    setEditingCost(null);
  }, [editingCost, tableData]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'concept',
        title: 'Concepto del Gasto',
        render: (value: string, record: OtherCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost.concept || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, concept: e.target.value })
              }
              className="cost-input"
              placeholder="Descripción del gasto"
            />
          ) : (
            value
          )
      },
      {
        key: 'quantity',
        title: 'Cantidad',
        render: (value: number, record: OtherCost) =>
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
        render: (value: number, record: OtherCost) =>
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
        render: (_: any, record: OtherCost) =>
          (record.quantity * record.unitCost).toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          })
      },
      {
        key: 'refactorable',
        title: 'Refacturable',
        render: (value: boolean, record: OtherCost) =>
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
        render: (_: any, record: OtherCost) =>
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
                  deleteOtherCost(record.id);
                  setTableData(prev => prev.filter(c => c.id !== record.id));
                }}
              >
                Eliminar
              </Button>
            </div>
          )
      }
    ],
    [editingCost, handleSaveCost, handleCancelEdit, handleEditCost, deleteOtherCost]
  );

  // Estado vacío
  if (tableData.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay otros gastos"
          description="Añade tu primer gasto adicional"
          action={
            <Button variant="primary" onClick={handleAddNewCost}>
              Añadir Gasto
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

export default OtherCosts;
