// src/components/costs/NonOperationalCosts.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { useProject } from '../../hooks/useProject';
import { NonOperationalCost } from '../../types/costs';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { CostTable } from './CostTable';
import './Costs.css';

interface NonOperationalCostsProps {
  context: NonOperationalCost['context'];
  costs?: NonOperationalCost[];
  onChange?: (updatedCosts: NonOperationalCost[]) => void;
}

export const NonOperationalCosts: React.FC<NonOperationalCostsProps> = ({ context }) => {
  const { 
    nonOperationalCosts, 
    addNonOperationalCost, 
    updateNonOperationalCost, 
    deleteNonOperationalCost,
    getProjectYears
  } = useProject();

  const [tableData, setTableData] = useState<NonOperationalCost[]>(
    nonOperationalCosts.filter(cost => cost.context === context)
  );
  const [editingCost, setEditingCost] = useState<Partial<NonOperationalCost> | null>(null);

  // Obtener opciones de tipo según el contexto
  const getTypeOptions = () => {
    switch(context) {
      case 'it': return ['License', 'Material'];
      case 'subcontract': return ['Fixed Price', 'Work Units'];
      case 'travel': return ['Plane', 'Train', 'Hotel', 'Allowances'];
      default: return [];
    }
  };

  // Añadir nueva fila editable
  const handleAddNewCost = useCallback(() => {
    const newCost: NonOperationalCost = {
      id: Date.now(),
      type: '',
      subcontractorName: '',
      quantity: 1,
      unitCost: 0,
      assignation: 'project',
      reinvoiced: false,
      context: context,
      year: undefined
    };
    setTableData(prev => [...prev, newCost]);
    setEditingCost(newCost);
  }, [context]);

  // Editar coste existente
  const handleEditCost = useCallback((cost: NonOperationalCost) => {
    setEditingCost({ ...cost });
  }, []);

  // Guardar coste (nuevo o editado)
  const handleSaveCost = useCallback(() => {
    if (!editingCost || !editingCost.subcontractorName?.trim()) {
      alert('El nombre del gasto es obligatorio');
      return;
    }

    const costToSave: NonOperationalCost = { 
      ...editingCost as NonOperationalCost,
      context: context
    };

    const exists = tableData.some(c => c.id === editingCost.id);
    if (!exists) {
      addNonOperationalCost(costToSave);
      setTableData(prev => [...prev, costToSave]);
    } else {
      updateNonOperationalCost(editingCost.id!, costToSave);
      setTableData(prev =>
        prev.map(c => (c.id === editingCost.id ? costToSave : c))
      );
    }

    setEditingCost(null);
  }, [editingCost, tableData, context, addNonOperationalCost, updateNonOperationalCost]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    if (tableData.some(c => c.id === editingCost?.id && !c.subcontractorName)) {
      setTableData(prev => prev.filter(c => c.id !== editingCost?.id));
    }
    setEditingCost(null);
  }, [editingCost, tableData]);

  // Columnas de la tabla
  const columns = useMemo(
    () => [
      {
        key: 'type',
        title: 'Cost type',
        render: (value: string, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <select
              value={editingCost.type || ''}
              onChange={e => setEditingCost({ ...editingCost, type: e.target.value })}
              className="cost-input"
            >
              <option value="">Seleccione...</option>
              {getTypeOptions().map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : (
            value || '-'
          )
      },
      {
        key: 'subcontractorName',
        title: 'Concept',
        render: (value: string, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost.subcontractorName || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, subcontractorName: e.target.value })
              }
              className="cost-input"
              placeholder="Cost concept"
            />
          ) : (
            value
          )
      },
      {
        key: 'quantity',
        title: 'Quantity',
        render: (value: number, record: NonOperationalCost) =>
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
        title: 'Unit Cost (€)',
        render: (value: number, record: NonOperationalCost) =>
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
        key: 'assignation',
        title: 'Assignation',
        render: (value: 'project' | 'per use', record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <select
              value={editingCost.assignation || 'project'}
              onChange={e => 
                setEditingCost({ 
                  ...editingCost, 
                  assignation: e.target.value as 'project' | 'per use' 
                })
              }
              className="cost-input"
            >
              <option value="project">Cost to project</option>
              <option value="per use">Per use</option>
            </select>
          ) : (
            value === 'project' ? 'Cost to project' : 'Per use'
          )
      },
      {
        key: 'year',
        title: 'Year',
        render: (value: number | undefined, record: NonOperationalCost) => {
          const projectYears = getProjectYears();
          console.log('Project Years:', projectYears);
          return projectYears.length > 0 && editingCost?.id === record.id ? (
            <select
              value={editingCost.year || ''}
              onChange={e => 
                setEditingCost({ 
                  ...editingCost, 
                  year: e.target.value ? Number(e.target.value) : undefined 
                })
              }
              className="cost-input"
            >
              <option value="">Select...</option>
              {projectYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          ) : (
            value || '-'
          );
        }
      },
      {
        key: 'reinvoiced',
        title: 'Reinvoiced',
        render: (value: boolean, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <input
              type="checkbox"
              checked={editingCost.reinvoiced || false}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
                  reinvoiced: e.target.checked
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
        title: 'Actions',
        render: (_: any, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <div className="table-row-actions">
              <Button variant="success" size="sm" onClick={handleSaveCost}>
                Save
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="table-row-actions">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleEditCost(record)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  deleteNonOperationalCost(record.id);
                  setTableData(prev => prev.filter(c => c.id !== record.id));
                }}
              >
                Delete
              </Button>
            </div>
          )
      }
    ],
    [
      editingCost, 
      context, 
      handleSaveCost, 
      handleCancelEdit, 
      handleEditCost, 
      deleteNonOperationalCost,
      getProjectYears
    ]
  );

  // Estado vacío
  if (tableData.length === 0) {
    return (
      <Card>
        <EmptyState
          title={`No hay costes de ${context}`}
          description={`Añade tu primer coste de ${context}`}
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

export default NonOperationalCosts;