import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { NonOperationalCost } from '../../types/nonOperationalCost';
import { fetchNonOperationalCosts, createNonOperationalCost, updateNonOperationalCost, deleteNonOperationalCost } from '../../api/nonOperationalCosts';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { Table, TableColumn } from '../ui/Table';
import { TreeSelector } from '../ui/TreeSelector';
import './Costs.css';
import { WorkPackage, Deliverable, Step } from '../../types/workPackages';
import { fetchWorkPackages } from '../../api/workPackagesApi';
import { fetchDeliverables } from '../../api/deliverablesApi';
import { fetchSteps } from '../../api/stepsApi';
import { fetchNonOperationalCostById } from '../../api/nonOperationalCosts';

interface NonOperationalCostsProps { projectId: number; context: NonOperationalCost['context']; projectYears?: number[]; }

export const NonOperationalCosts: React.FC<NonOperationalCostsProps> = ({ projectId, context, projectYears }) => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<NonOperationalCost[]>([]);
  const [editingCost, setEditingCost] = useState<Partial<NonOperationalCost> | null>(null);
  const [wpTree, setWpTree] = useState<WorkPackage[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<number[]>([]);
  const [accordionOpen, setAccordionOpen] = useState<boolean>(false);
  const [expandedRows, setExpandedRows] = useState<Array<string | number>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNonOperationalCosts(projectId, context);
      setTableData(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId, context]);

  useEffect(() => { load(); }, [load]);

  // Load full WP -> Deliverables -> Steps tree for selection when needed
  const loadProjectTree = useCallback(async () => {
    try {
      const wps = await fetchWorkPackages(projectId);
      const withChildren: WorkPackage[] = await Promise.all(
        (wps || []).map(async (wp) => {
          const deliverables = await fetchDeliverables(projectId, wp.id);
          const delivsWithSteps: Deliverable[] = await Promise.all(
            deliverables.map(async (d) => {
              try {
                const remote = await fetchSteps(projectId, wp.id, d.id);
                const steps: Step[] = (remote || []).map((r: any) => ({
                  id: r.id,
                  name: r.nombre ?? r.name,
                  profile: r.profile_name ?? r.profile,
                  country: r.country_name ?? r.country,
                  processTime: Number(r.process_time ?? r.processTime ?? 0),
                  units: r.unit === 'h' ? 'Hours' : r.unit === 'd' ? 'Days' : 'Months',
                  office: r.office ? 'Yes' : 'No',
                  mngPercent: Number(r.mng ?? r.mngPercent ?? 0),
                  licenses: [],
                  hardware: r.hardware ? 'Yes' : 'No',
                }));
                return { ...d, steps } as Deliverable;
              } catch {
                return { ...d, steps: [] } as Deliverable;
              }
            })
          );
          return { ...wp, deliverables: delivsWithSteps } as WorkPackage;
        })
      );
      setWpTree(withChildren);
    } catch (e) {
      console.warn('Failed to load project tree', e);
      setWpTree([]);
    }
  }, [projectId]);

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
    // Sin id para que pase por la rama de creación y no intente actualizar
    const newCost: NonOperationalCost = {
      project_id: projectId,
      context,
      type: '',
      concept: '',
      quantity: 1,
      unit_cost: 0,
      reinvoiced: false,
      year: undefined
    };
    setTableData(prev => [newCost, ...prev]);
    setEditingCost(newCost);
  }, [context, projectId]);

  // Editar coste existente
  const handleEditCost = useCallback((cost: NonOperationalCost) => {
    setEditingCost({ ...cost });
    setSelectedStepIds(Array.isArray(cost.step_ids) ? cost.step_ids : []);
    setAccordionOpen(true);
    if (wpTree.length === 0) void loadProjectTree();
  }, [wpTree.length, loadProjectTree]);
  // Guardar coste (nuevo o editado)
  const handleSaveCost = useCallback(async () => {
    if (!editingCost || !editingCost.concept?.trim()) { alert('El concepto es obligatorio'); return; }
  // Nuevo si no tiene id (aún no persistido) o si id fuera de rango entero PostgreSQL (protección defensiva)
  const isNew = !editingCost.id || editingCost.id > 2147483647;
    try {
      if (isNew) {
        const created = await createNonOperationalCost(projectId, {
          context,
          type: editingCost.type || '',
            concept: editingCost.concept || '',
          quantity: editingCost.quantity ?? 1,
          unit_cost: editingCost.unit_cost ?? 0,
          // assignation removed; do not send assignation field
          year: editingCost.year ?? null,
      reinvoiced: !!editingCost.reinvoiced,
      ...(selectedStepIds && selectedStepIds.length ? { step_ids: selectedStepIds } : {})
        });
  // Reemplaza la fila temporal (sin id) por la creada
  setTableData(prev => [created, ...prev.filter(c => c.id)]);
      } else {
  const updated = await updateNonOperationalCost(projectId, editingCost.id as number, {
          type: editingCost.type,
          concept: editingCost.concept,
          quantity: editingCost.quantity,
          unit_cost: editingCost.unit_cost,
          year: editingCost.year,
      reinvoiced: editingCost.reinvoiced,
      ...(selectedStepIds && selectedStepIds.length ? { step_ids: selectedStepIds } : {})
        });
        setTableData(prev => prev.map(c => c.id === updated.id ? updated : c));
      }
    setEditingCost(null);
    setAccordionOpen(false);
    setSelectedStepIds([]);
    } catch(e) { console.error(e); alert('Error saving cost'); }
  }, [editingCost, tableData, context, projectId, selectedStepIds]);

  // Cancelar edición
  const handleCancelEdit = useCallback(() => {
    if (editingCost && (!editingCost.id || tableData.every(c => c.id !== editingCost.id))) {
      setTableData(prev => prev.filter(c => c.id !== editingCost.id));
    }
    setEditingCost(null);
  }, [editingCost, tableData]);

  // Columnas de la tabla
  const columns: TableColumn<NonOperationalCost>[] = useMemo(
    () => [
      {
        key: 'type',
        title: 'Cost type',
  render: (value: string, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <select
              value={editingCost?.type || ''}
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
        key: 'concept',
        title: 'Concept',
  render: (value: string, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <input
              type="text"
              value={editingCost?.concept || ''}
              onChange={e =>
                setEditingCost({ ...editingCost, concept: e.target.value })
              }
              className="cost-input"
              placeholder="Cost concept"
            />
          ) : (
            value || '-'
          )
      },
      {
        key: 'quantity',
        title: 'Quantity',
  render: (value: number, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <input
              type="number"
              value={editingCost?.quantity ?? 1}
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
    key: 'unit_cost',
        title: 'Unit Cost (€)',
  render: (value: number, record: NonOperationalCost) =>
          editingCost?.id === record.id ? (
            <input
              type="number"
              value={editingCost?.unit_cost ?? 0}
              min={0}
              step={0.01}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
          unit_cost: Number(e.target.value)
                })
              }
              className="cost-input"
            />
          ) : (
      (value || 0).toLocaleString('es-ES', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            })
          )
      },
  // Assignation column removed — selection is handled via the tree and step_ids
      {
        key: 'year',
        title: 'Year',
        render: (value: number | undefined, record: NonOperationalCost) => {
          const years = projectYears || [];
          // Si no hay rango definido mostramos '-'
          if (years.length === 0) {
            // Caso sin fechas definidas todavía
            return value || '-';
          }
          // Si sólo hay un año, mostrarlo plano (sin select)
            if (years.length === 1) {
            return years[0];
          }
          return editingCost?.id === record.id ? (
            <select
              value={editingCost?.year || ''}
              onChange={e =>
                setEditingCost({
                  ...editingCost,
                  year: e.target.value ? Number(e.target.value) : undefined
                })
              }
              className="cost-input"
            >
              <option value="">Select...</option>
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
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
              checked={editingCost?.reinvoiced || false}
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
                onClick={async () => {
                  if (!record.id) return;
                  try {
                    await deleteNonOperationalCost(projectId, record.id);
                    setTableData(prev => prev.filter(c => c.id !== record.id));
                  } catch(e) { console.error(e); alert('Error deleting cost'); }
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
      handleSaveCost, 
      handleCancelEdit, 
      handleEditCost, 
      projectId,
      wpTree,
      loadProjectTree,
      projectYears
    ]
  );

  // Estado vacío
  if (!loading && tableData.length === 0) {
    return (
      <Card>
        <EmptyState
          title={`This project has no ${context} costs`}
          description={`Add your first ${context} cost`}
          action={
            <Button variant="primary" onClick={handleAddNewCost}>
              Add Cost
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
          + New Cost
        </Button>
      </div>

      <Table
        data={tableData}
        columns={columns}
  rowKey={(r: NonOperationalCost) => (r.id ?? `${r.concept}-${r.type}`)}
        rowClassName={(record) => (editingCost?.id === record.id ? 'new-cost-row' : '')}
        expandable={{
          rowExpandable: (_record: NonOperationalCost) => true,
          expandedRowKeys: expandedRows,
          onExpand: async (expanded: boolean, record: NonOperationalCost) => {
            setExpandedRows(prev => {
              const key = record.id ?? `row-${tableData.indexOf(record)}`;
              const set = new Set(prev);
              if (expanded) set.add(key); else set.delete(key);
              return Array.from(set);
            });
            if (expanded) {
              if (wpTree.length === 0) await loadProjectTree();
              if (record.id && (record.step_ids === undefined)) {
                try {
                  const full = await fetchNonOperationalCostById(projectId, record.id);
                  setTableData(prev => prev.map(c => c.id === full.id ? full : c));
                  if (editingCost?.id === record.id) {
                    setSelectedStepIds(Array.isArray(full.step_ids) ? full.step_ids : []);
                  }
                } catch (e) {
                  console.warn('Failed to load cost step_ids', e);
                }
              }
            }
          },
          expandedRowRender: (record: NonOperationalCost) => (
            <div className="vertical-accordion" style={{ margin: 0 }}>
              <div className="accordion-body" style={{ padding: '16px' }}>
                {wpTree.length === 0 ? (
                  <div style={{ fontSize: '.9rem', color: '#666' }}>Loading steps...</div>
                ) : (
                  <TreeSelector
                    workPackages={wpTree}
                    selectedStepIds={editingCost?.id === record.id ? selectedStepIds : (record.step_ids || [])}
                    editable={editingCost?.id === record.id}
                    onChange={(stepIds: number[]) => {
                      if (editingCost?.id === record.id) {
                        setSelectedStepIds(stepIds);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          )
        }}
      />
    </Card>
  );
};

export default NonOperationalCosts;