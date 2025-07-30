import React, { useState } from 'react';
import StepsTable from './StepsTable';
import {Button} from '../ui/Button';
import { Deliverable, Step } from '../../types/project';
import { useProject } from '../../hooks/useProject';
import './DeliverableCard.css';

interface DeliverableCardProps {
  workPackageId: number;
  deliverable: Deliverable;
  onUpdateDeliverable: (deliverable: Deliverable) => void;
  onDeleteDeliverable: () => void;
}

const DeliverableCard: React.FC<DeliverableCardProps> = ({
  workPackageId,
  deliverable,
  onUpdateDeliverable,
  onDeleteDeliverable
}) => {
  const { projectData } = useProject();
  const [isExpanded, setIsExpanded] = useState(false);

  // Manejar cambio de nombre del Deliverable
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdateDeliverable({
      ...deliverable,
      name: e.target.value
    });
  };

  // Manejar cambio de margen
  const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const margin = parseFloat(e.target.value);
    onUpdateDeliverable({
      ...deliverable,
      margin: isNaN(margin) ? 0 : margin
    });
  };

  // Manejar cambio de cantidad por año
  const handleYearlyQuantityChange = (year: number, quantity: number) => {
    const updatedYearlyQuantities = {
      ...deliverable.yearlyQuantities,
      [year]: quantity
    };

    onUpdateDeliverable({
      ...deliverable,
      yearlyQuantities: updatedYearlyQuantities
    });
  };

  // Agregar un nuevo step
  const handleAddStep = () => {
    const newStep: Step = {
      id: Date.now(),
      name: '',
      profile: '',
      country: '',
      processTime: 0,
      timeUnits: 'horas',
      office: false,
      it: false,
      mngPercent: 0,
      nptPercent: 0,
      licenses: []
    };

    onUpdateDeliverable({
      ...deliverable,
      steps: [...deliverable.steps, newStep]
    });
  };

  // Actualizar un step
  const handleUpdateStep = (updatedStep: Step) => {
    const updatedSteps = deliverable.steps.map(step => 
      step.id === updatedStep.id ? updatedStep : step
    );

    onUpdateDeliverable({
      ...deliverable,
      steps: updatedSteps
    });
  };

  // Eliminar un step
  const handleDeleteStep = (stepId: number) => {
    const updatedSteps = deliverable.steps.filter(step => step.id !== stepId);

    onUpdateDeliverable({
      ...deliverable,
      steps: updatedSteps
    });
  };

  // Calcular métricas del Deliverable
  const calculateDeliverableMetrics = () => {
    const totalSteps = deliverable.steps.length;
    const totalProcessTime = deliverable.steps.reduce(
      (total, step) => total + step.processTime, 
      0
    );

    return {
      totalSteps,
      totalProcessTime
    };
  };

  const { totalSteps, totalProcessTime } = calculateDeliverableMetrics();

  // Generar inputs de cantidad por año
  const renderYearlyQuantityInputs = () => {
    if (!projectData.multiyear) {
      return (
        <div className="yearly-quantity-input">
          <label>Cantidad:</label>
          <input
            type="number"
            value={deliverable.yearlyQuantities[new Date().getFullYear()] || 0}
            onChange={(e) => handleYearlyQuantityChange(
              new Date().getFullYear(), 
              parseInt(e.target.value) || 0
            )}
            min="0"
          />
        </div>
      );
    }

    const startYear = projectData.startYear || new Date().getFullYear();
    const endYear = projectData.endYear || startYear;

    return (
      <div className="yearly-quantity-inputs">
        <label>Cantidades por año:</label>
        {Array.from({ length: endYear - startYear + 1 }, (_, index) => {
          const year = startYear + index;
          return (
            <div key={year} className="yearly-quantity-input">
              <span>{year}:</span>
              <input
                type="number"
                value={deliverable.yearlyQuantities[year] || 0}
                onChange={(e) => handleYearlyQuantityChange(
                  year, 
                  parseInt(e.target.value) || 0
                )}
                min="0"
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`deliverable-card ${isExpanded ? 'expanded' : ''}`}>
      {/* Cabecera del Deliverable */}
      <div className="deliverable-header">
        <div className="deliverable-header-content">
          <div className="deliverable-id">
            D{deliverable.id}
          </div>
          
          <input 
            type="text"
            value={deliverable.name}
            onChange={handleNameChange}
            placeholder="Nombre del Deliverable"
            className="deliverable-name-input"
          />

          <div className="deliverable-margin-input">
            <label>Margen:</label>
            <input
              type="number"
              value={deliverable.margin}
              onChange={handleMarginChange}
              min="0"
              max="100"
            />
            <span>%</span>
          </div>

          <div className="deliverable-actions">
            <Button 
              variant="success" 
              size="sm"
              onClick={handleAddStep}
            >
              + Step
            </Button>
            
            <Button 
              variant="outline-secondary" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '▲' : '▼'} {totalSteps} steps
            </Button>
            
            <Button 
              variant="danger" 
              size="sm"
              onClick={onDeleteDeliverable}
            >
              🗑️
            </Button>
          </div>
        </div>
      </div>

      {/* Inputs de Cantidad por Año */}
      <div className="deliverable-yearly-quantities">
        {renderYearlyQuantityInputs()}
      </div>

      {/* Métricas del Deliverable */}
      <div className="deliverable-metrics">
        <div className="metric-item">
          <span className="metric-label">Steps</span>
          <span className="metric-value">{totalSteps}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Tiempo Total</span>
          <span className="metric-value">{totalProcessTime.toFixed(1)} h</span>
        </div>
      </div>

      {/* Sección de Steps */}
      {isExpanded && (
        <div className="deliverable-steps">
          {deliverable.steps.length === 0 ? (
            <div className="no-steps">
              No hay steps. Haga clic en "Agregar Step" para comenzar.
            </div>
          ) : (
            <StepsTable
              steps={deliverable.steps}
              onUpdateStep={handleUpdateStep}
              onDeleteStep={handleDeleteStep}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default DeliverableCard;