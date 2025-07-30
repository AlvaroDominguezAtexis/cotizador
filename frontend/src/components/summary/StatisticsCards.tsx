// src/components/summary/StatisticsCard.tsx
import React, { useMemo } from 'react';
import './Summary.css';

interface StatisticsCardProps {
  profiles: any[];
  workPackages: any[];
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({ profiles, workPackages }) => {
  // Calcular estadísticas
  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <h2>Estadísticas</h2>
      </div>
      <div className="summary-card-content">
        <div className="summary-card-item">
          <span className="summary-card-item-label">Perfiles</span>
          <span className="summary-card-item-value">{profiles?.length || 0}</span>
        </div>
        <div className="summary-card-item">
          <span className="summary-card-item-label">Paquetes de Trabajo</span>
          <span className="summary-card-item-value">{workPackages?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCard;