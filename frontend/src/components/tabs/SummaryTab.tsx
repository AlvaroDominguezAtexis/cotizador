// src/components/tabs/SummaryTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import { ProjectSummary } from '../summary/ProjectSummary';
import { FinancialSummary } from '../summary/FinancialSummary';
import { StatisticsCard } from '../summary/StatisticsCards';
import './Tabs.css';

interface SummaryTabProps {
  project: any;
  profiles: any[];
  workPackages: any[];
  costs: any;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ project, profiles, workPackages, costs }) => {
  const handleExport = () => {
    const summaryData = {
      project,
      workPackages,
      profiles,
      costs
    };
    const blob = new Blob([JSON.stringify(summaryData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumen_proyecto_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Resumen del Proyecto</h1>
        <div className="tab-actions">
          <Button 
            variant="secondary"
            onClick={handlePrint}
          >
            Imprimir Resumen
          </Button>
          <Button 
            variant="primary"
            onClick={handleExport}
          >
            Exportar Resumen
          </Button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="summary-main-content">
          <Card>
            <ProjectSummary project={project} workPackages={workPackages} />
          </Card>
          <Card>
            <FinancialSummary costs={costs} profiles={profiles} />
          </Card>
        </div>

        <div className="summary-sidebar">
          <StatisticsCard profiles={profiles} workPackages={workPackages} />
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;