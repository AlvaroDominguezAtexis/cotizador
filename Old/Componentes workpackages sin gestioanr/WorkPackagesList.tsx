import React, { useState } from 'react';
import WorkPackageCard from './WorkPackagesCard';
import {Button} from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { WorkPackage, Deliverable } from '../../types/project';
import './WorkPackagesList.css';

interface WorkPackagesListProps {
  workPackages: WorkPackage[];
  onAddWorkPackage: () => void;
  onUpdateWorkPackage: (updatedWorkPackage: WorkPackage) => void;
  onDeleteWorkPackage: (workPackageId: number) => void;
  onAddDeliverable: (workPackageId: number) => void;
}

const WorkPackagesList: React.FC<WorkPackagesListProps> = ({
  workPackages,
  onAddWorkPackage,
  onUpdateWorkPackage,
  onDeleteWorkPackage,
  onAddDeliverable
}) => {
  // Estado para manejar la expansión de work packages
  const [expandedWorkPackages, setExpandedWorkPackages] = useState<number[]>([]);

  // Alternar expansión de un work package
  const toggleWorkPackageExpansion = (workPackageId: number) => {
    setExpandedWorkPackages(prev => 
      prev.includes(workPackageId)
        ? prev.filter(id => id !== workPackageId)
        : [...prev, workPackageId]
    );
  };

  // Agregar un nuevo deliverable a un work package
  const handleAddDeliverable = (workPackageId: number) => {
    onAddDeliverable(workPackageId);
  };

  // Actualizar un deliverable
  const handleUpdateDeliverable = (
    workPackageId: number, 
    updatedDeliverable: Deliverable
  ) => {
    const workPackageToUpdate = workPackages.find(wp => wp.id === workPackageId);
    
    if (workPackageToUpdate) {
      const updatedDeliverables = workPackageToUpdate.deliverables.map(del => 
        del.id === updatedDeliverable.id ? updatedDeliverable : del
      );

      onUpdateWorkPackage({
        ...workPackageToUpdate,
        deliverables: updatedDeliverables
      });
    }
  };

  // Eliminar un deliverable
  const handleDeleteDeliverable = (
    workPackageId: number, 
    deliverableId: number
  ) => {
    const workPackageToUpdate = workPackages.find(wp => wp.id === workPackageId);
    
    if (workPackageToUpdate) {
      const updatedDeliverables = workPackageToUpdate.deliverables.filter(
        del => del.id !== deliverableId
      );

      onUpdateWorkPackage({
        ...workPackageToUpdate,
        deliverables: updatedDeliverables
      });
    }
  };

  return (
    <div className="work-packages-list">
      <div className="work-packages-header">
        <h2 className="section-title">Work Packages y Deliverables</h2>
        <Button 
          variant="success" 
          onClick={onAddWorkPackage}
        >
          ➕ Agregar Work Package
        </Button>
      </div>

      {workPackages.length === 0 ? (
        <EmptyState 
          title="No hay Work Packages"
          description="Comience agregando su primer Work Package"
          action={
            <Button onClick={onAddWorkPackage}>
              Crear Work Package
            </Button>
          }
        />
      ) : (
        <div className="work-packages-grid">
          {workPackages.map(workPackage => (
            <WorkPackageCard
              key={workPackage.id}
              workPackage={workPackage}
              isExpanded={expandedWorkPackages.includes(workPackage.id)}
              onToggleExpand={() => toggleWorkPackageExpansion(workPackage.id)}
              onUpdateWorkPackage={onUpdateWorkPackage}
              onDeleteWorkPackage={() => onDeleteWorkPackage(workPackage.id)}
              onAddDeliverable={() => handleAddDeliverable(workPackage.id)}
              onUpdateDeliverable={(del) => handleUpdateDeliverable(workPackage.id, del)}
              onDeleteDeliverable={(delId) => handleDeleteDeliverable(workPackage.id, delId)}
            />
          ))}
        </div>
      )}

      {/* Resumen de Work Packages */}
      {workPackages.length > 0 && (
        <div className="work-packages-summary">
          <div className="summary-item">
            <strong>Total Work Packages:</strong> {workPackages.length}
          </div>
          <div className="summary-item">
            <strong>Total Deliverables:</strong> {
              workPackages.reduce((total, wp) => total + wp.deliverables.length, 0)
            }
          </div>
          <div className="summary-item">
            <strong>Total Steps:</strong> {
              workPackages.reduce(
                (total, wp) => total + wp.deliverables.reduce(
                  (delTotal, del) => delTotal + del.steps.length, 0
                ), 
                0
              )
            }
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkPackagesList;