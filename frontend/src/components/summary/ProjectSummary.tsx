// src/components/summary/ProjectSummary.tsx
import React from 'react';
import { useProject } from '../../hooks/useProject';
import './Summary.css';

interface ProjectSummaryProps {
  project: any;
  workPackages: any[];
}

export const ProjectSummary: React.FC<ProjectSummaryProps> = ({ project, workPackages }) => {
  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <h2>Resumen del Proyecto</h2>
      </div>
      
      <div className="summary-card-content">
        <div className="summary-card-item">
          <span className="summary-card-item-label">Título</span>
          <span className="summary-card-item-value">
            {project?.title || 'No definido'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Código CRM</span>
          <span className="summary-card-item-value">
            {project?.crmCode || 'No definido'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Cliente</span>
          <span className="summary-card-item-value">
            {project?.client || 'No definido'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Actividad</span>
          <span className="summary-card-item-value">
            {project?.activity || 'No definido'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Fecha de Inicio</span>
          <span className="summary-card-item-value">
            {project?.startDate 
              ? new Date(project?.startDate).toLocaleDateString() 
              : 'No definida'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Paquetes de Trabajo</span>
          <span className="summary-card-item-value">
            {workPackages?.length || 0}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Ámbito</span>
          <span className="summary-card-item-value">
            {project?.scope === 'local' ? 'Local' : 'Transnacional'}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Segmentación</span>
          <span className="summary-card-item-value">
            {project?.segmentation || 'No definida'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProjectSummary;