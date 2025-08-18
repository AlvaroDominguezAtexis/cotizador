// src/components/summary/SummaryDocument.tsx
import React, { useMemo } from 'react';
import './Summary.css';

interface SummaryDocumentProps {
  project: any;
  profiles: any[];
  workPackages: any[];
  costs: any;
}

const SummaryRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="summary-card-item">
    <span className="summary-card-item-label">{label}</span>
    <span className="summary-card-item-value">{value}</span>
  </div>
);

export const SummaryDocument: React.FC<SummaryDocumentProps> = ({ project, profiles, workPackages, costs }) => {
  // Financial totals (reuse logic from FinancialSummary)
  const totals = useMemo(() => {
    const calc = (arr: any[] = []) => arr.reduce((t, c) => {
      const unit = c.unit_cost ?? c.unitCost ?? 0;
      return t + (Number(c.quantity || 0) * Number(unit));
    }, 0);
    const travel = calc(costs?.travelCosts);
    const subcontract = calc(costs?.subcontractCosts);
    const it = calc(costs?.itCosts);
    const other = calc(costs?.otherCosts);
    return { travel, subcontract, it, other };
  }, [costs]);

  const personnelCosts = useMemo(() => {
    return (profiles || []).reduce((total, profile) => {
      const countrySalaries = Object.values(profile.salaries || {});
      const profileTotal = (countrySalaries as number[]).reduce((sum, salary) => sum + salary, 0);
      return total + profileTotal;
    }, 0);
  }, [profiles]);

  const totalProjectCost = useMemo(() => {
    const nonPersonnel = Object.values(totals).reduce((a, b) => a + b, 0);
    return nonPersonnel + personnelCosts;
  }, [totals, personnelCosts]);

  return (
    <div className="summary-card" style={{ padding: 0 }}>
      <div className="summary-card-header" style={{ borderBottom: '1px solid #eee' }}>
        <h2>Resumen del Proyecto</h2>
      </div>
      <div className="summary-card-content">
        {/* Project section */}
        <h3 style={{ marginTop: 0 }}>Proyecto</h3>
        <SummaryRow label="Título" value={project?.title || 'No definido'} />
        <SummaryRow label="Código CRM" value={project?.crmCode || 'No definido'} />
        <SummaryRow label="Cliente" value={project?.client || 'No definido'} />
        <SummaryRow label="Actividad" value={project?.activity || 'No definida'} />
        <SummaryRow label="Fecha de Inicio" value={project?.startDate ? new Date(project.startDate).toLocaleDateString() : 'No definida'} />
        <SummaryRow label="Fecha de Fin" value={project?.endDate ? new Date(project.endDate).toLocaleDateString() : 'No definida'} />
        <SummaryRow label="Ámbito" value={project?.scope === 'local' ? 'Local' : 'Transnacional'} />
        <SummaryRow label="Segmentación" value={project?.segmentation || 'No definida'} />

        {/* Divider */}
        <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />

        {/* Financial section */}
        <h3>Finanzas</h3>
        <SummaryRow label="Costes de Viaje" value={(totals.travel || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
        <SummaryRow label="Costes de Subcontrata" value={(totals.subcontract || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
        <SummaryRow label="Costes de IT" value={(totals.it || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
        <SummaryRow label="Otros Costes" value={(totals.other || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
        <SummaryRow label="Costes de Personal" value={(personnelCosts || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} />
        <div className="summary-card-item">
          <span className="summary-card-item-label">Coste Total del Proyecto</span>
          <span className="summary-card-item-value" style={{ color: '#28a745' }}>
            {totalProjectCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </span>
        </div>

        {/* Divider */}
        <hr style={{ margin: '16px 0', border: 0, borderTop: '1px solid #eee' }} />

        {/* Statistics section */}
        <h3>Estadísticas</h3>
        <SummaryRow label="Perfiles" value={profiles?.length || 0} />
        <SummaryRow label="Paquetes de Trabajo" value={workPackages?.length || 0} />
      </div>
    </div>
  );
};

export default SummaryDocument;
