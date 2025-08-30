// src/components/tabs/SummaryTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import SummaryDocument from '../summary/SummaryDocument';
import { recalcProjectStepsCosts } from '../../api/stepsApi';
import { recomputeItCosts } from '../../api/nonOperationalCosts';
import './Tabs.css';

interface SummaryTabProps {
  project: any;
  profiles: any[];
  workPackages: any[];
  costs: any;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ project, profiles, workPackages, costs }) => {
  const [loading, setLoading] = React.useState(false);
  const [recalcId, setRecalcId] = React.useState<number>(0);

  // Recalculate costs when loading summary
  React.useEffect(() => {
    const recalcCosts = async () => {
      if (!project?.id) return;
      
      try {
        setLoading(true);
        const res = await recalcProjectStepsCosts(project.id);
        // After salaries/management are recalculated, recompute IT costs per project year
        // derive years from project start/end if available, otherwise fallback to years present in res or current year
        let years: number[] = [];
        if (project?.startDate && project?.endDate) {
          const sy = new Date(project.startDate).getFullYear();
          const ey = new Date(project.endDate).getFullYear();
          if (!isNaN(sy) && !isNaN(ey) && ey >= sy) {
            for (let y = sy; y <= ey; y++) years.push(y);
          }
        }
        if (years.length === 0 && Array.isArray(res?.costs) && res.costs.length) {
          years = Array.from(new Set(res.costs.map((c: any) => Number(c.year)).filter((n: number) => !Number.isNaN(n))));
        }
        if (years.length === 0) years = [new Date().getFullYear()];

        for (const y of years) {
          try {
            await recomputeItCosts(project.id, y);
          } catch (e) {
            console.error('Error recomputing IT costs for year', y, e);
          }
        }
      } catch (e) {
        console.error('Error recalculating project costs:', e);
      } finally {
  setLoading(false);
  // mark that a recalc has completed so SummaryDocument remounts and fetches fresh data
  setRecalcId(Date.now());
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
            {/* Render SummaryDocument after a recalc has run so the backend calculations are fresh */}
            {recalcId !== 0 && (
              <SummaryDocument key={recalcId} project={project} workPackages={workPackages} profiles={profiles} costs={costs} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;