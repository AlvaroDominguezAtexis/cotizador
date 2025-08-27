// src/components/tabs/SummaryTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import SummaryDocument from '../summary/SummaryDocument';
import { recalcProjectStepsCosts } from '../../api/stepsApi';
import './Tabs.css';

interface SummaryTabProps {
  project: any;
  profiles: any[];
  workPackages: any[];
  costs: any;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ project, profiles, workPackages, costs }) => {
  const [loading, setLoading] = React.useState(false);

  // Recalculate costs when loading summary
  React.useEffect(() => {
    const recalcCosts = async () => {
      if (!project?.id) return;
      
      try {
        setLoading(true);
        await recalcProjectStepsCosts(project.id);
      } catch (e) {
        console.error('Error recalculating project costs:', e);
      } finally {
        setLoading(false);
      }
    };

    recalcCosts();
  }, [project?.id]);

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
        {loading && <span style={{ marginLeft: 10, color: '#666' }}>Recalculando costes...</span>}
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

      <div >
        <div className="summary-main-content" style={{ width: '100%' }}>
          <Card>
            <SummaryDocument project={project} workPackages={workPackages} profiles={profiles} costs={costs} />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;