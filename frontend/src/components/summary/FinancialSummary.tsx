// src/components/summary/FinancialSummary.tsx

import React, { useMemo } from 'react';
import './Summary.css';

interface FinancialSummaryProps {
  costs: any;
  profiles: any[];
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({ costs, profiles }) => {
  // Calcular costes totales
  const totalCosts = useMemo(() => {
    const calculateTotal = (costsArr: any[] = []) => 
      costsArr.reduce((total, cost) => {
        const unit = cost.unit_cost ?? cost.unitCost ?? 0;
        return total + (Number(cost.quantity || 0) * Number(unit));
      }, 0);

    return {
      travel: calculateTotal(costs?.travelCosts),
      subcontract: calculateTotal(costs?.subcontractCosts),
      it: calculateTotal(costs?.itCosts),
      other: calculateTotal(costs?.otherCosts)
    };
  }, [costs]);

  // Calcular costes de personal
  const personnelCosts = useMemo(() => {
    return (profiles || []).reduce((total, profile) => {
      const countrySalaries = Object.values(profile.salaries || {});
      const profileTotal = (countrySalaries as number[]).reduce((sum, salary) => sum + salary, 0);
      return total + profileTotal;
    }, 0);
  }, [profiles]);

  // Calcular coste total
  const totalProjectCost = useMemo(() => {
    const nonPersonnelCosts = Object.values(totalCosts).reduce((a, b) => a + b, 0);
    return nonPersonnelCosts + personnelCosts;
  }, [totalCosts, personnelCosts]);

  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <h2>Resumen Financiero</h2>
      </div>
      
      <div className="summary-card-content">
        <div className="summary-card-item">
          <span className="summary-card-item-label">Costes de Viaje</span>
          <span className="summary-card-item-value">
            {totalCosts.travel.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Costes de Subcontrata</span>
          <span className="summary-card-item-value">
            {totalCosts.subcontract.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Costes de IT</span>
          <span className="summary-card-item-value">
            {totalCosts.it.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Otros Costes</span>
          <span className="summary-card-item-value">
            {totalCosts.other.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Costes de Personal</span>
          <span className="summary-card-item-value">
            {personnelCosts.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Coste Total del Proyecto</span>
          <span className="summary-card-item-value" style={{ color: '#28a745' }}>
            {totalProjectCost.toLocaleString('es-ES', {
              style: 'currency',
              currency: 'EUR'
            })}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Número de Perfiles</span>
          <span className="summary-card-item-value">
            {profiles?.length || 0}
          </span>
        </div>

        <div className="summary-card-item">
          <span className="summary-card-item-label">Tipos de Costes</span>
          <span className="summary-card-item-value">
            {Object.values(totalCosts).filter((cost: number) => cost > 0).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FinancialSummary;