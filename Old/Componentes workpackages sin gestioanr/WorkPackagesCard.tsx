import React, { useState } from 'react';
import DeliverableCard from './DeliverableCard';
import {Button} from '../ui/Button';
import { WorkPackage, Deliverable } from '../../types/project';
import './WorkPackagesCard.css';

interface WorkPackageCardProps {
  workPackage: WorkPackage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdateWorkPackage: (updatedWorkPackage: WorkPackage) => void;
  onDeleteWorkPackage: () => void;
  onAddDeliverable: () => void;
  onUpdateDeliverable: (deliverable: Deliverable) => void;
  onDeleteDeliverable: (deliverableId: number) => void;
}

const WorkPackageCard: React.FC<WorkPackageCardProps> = ({
  workPackage,
  isExpanded,
  onToggleExpand,
  onUpdateWorkPackage,
  onDeleteWorkPackage,
  onAddDeliverable,
  onUpdateDeliverable,
  onDeleteDeliverable
}) => {
  // Manejar cambio de nombre del Work Package
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateWorkPackage({
      ...workPackage,
      name: e.target.value
    });
  };

  // Calcular métricas del Work Package
  const calculateWorkPackageMetrics = () => {
    const totalDeliverables = workPackage.deliverables.length;
    const totalSteps = workPackage.deliverables.reduce(
      (total, del) => total + del.steps.length, 
      0
    );
    const averageMargin = totalDeliverables > 0
      ? workPackage.deliverables.reduce((sum, del) => sum + del.margin, 0) / totalDeliverables
      : 0;

    return {
      totalDeliverables,
      totalSteps,
      averageMargin
    };
  };

  const { totalDeliverables, totalSteps, averageMargin } = calculateWorkPackageMetrics();

  return (
    <div className={`work-package-card ${isExpanded ? 'expanded' : ''}`}>
      {/* Cabecera del Work Package */}
      <div className="work-package-header">
        <div className="work-package-header-content">
          <div className="work-package-id">
            WP{workPackage.id}
          </div>
          
          <input 
            type="text"
            value={workPackage.name}
            onChange={handleNameChange}
            placeholder="Nombre del Work Package"
            className="work-package-name-input"
          />

          <div className="work-package-actions">
            <Button 
              variant="success" 
              size="sm"
              onClick={onAddDeliverable}
            >
              + Deliverable
            </Button>
            
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={onToggleExpand}
            >
              {isExpanded ? '▲' : '▼'} {totalDeliverables} deliverables
            </Button>
            
            <Button 
              variant="danger" 
              size="sm"
              onClick={onDeleteWorkPackage}
            >
              🗑️
            </Button>
          </div>
        </div>
      </div>

      {/* Métricas del Work Package */}
      <div className="work-package-metrics">
        <div className="metric-item">
          <span className="metric-label">Deliverables</span>
          <span className="metric-value">{totalDeliverables}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Steps</span>
          <span className="metric-value">{totalSteps}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Margen Promedio</span>
          <span className="metric-value">{averageMargin.toFixed(1)}%</span>
        </div>
      </div>

      {/* Sección de Deliverables */}
      {isExpanded && (
        <div className="work-package-deliverables">
          {workPackage.deliverables.length === 0 ? (
            <div className="no-deliverables">
              No hay deliverables. Haga clic en "Agregar Deliverable" para comenzar.
            </div>
          ) : (
            workPackage.deliverables.map(deliverable => (
              <DeliverableCard
                key={deliverable.id}
                workPackageId={workPackage.id}
                deliverable={deliverable}
                onUpdateDeliverable={onUpdateDeliverable}
                onDeleteDeliverable={() => onDeleteDeliverable(deliverable.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default WorkPackageCard;