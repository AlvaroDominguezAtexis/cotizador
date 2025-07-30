// src/components/tabs/WorkPackagesTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import WorkPackagesManagement from '../workpackages/WorkPackagesManagement';
import './Tabs.css';

interface WorkPackagesTabProps {
  workPackages: any[];
  onChange: (workPackages: any[]) => void;
}

export const WorkPackagesTab: React.FC<WorkPackagesTabProps> = ({ workPackages, onChange }) => {
  const handleExport = () => {
    const workPackagesJson = JSON.stringify(workPackages, null, 2);
    const blob = new Blob([workPackagesJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `work_packages_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const importedWorkPackages = JSON.parse(event.target?.result as string);
            onChange(importedWorkPackages);
          } catch (error) {
            alert('Error al importar paquetes de trabajo. Formato de archivo inválido.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Paquetes de Trabajo</h1>
        <div className="tab-actions">
          <Button 
            variant="secondary"
            onClick={handleImport}
          >
            Importar Paquetes
          </Button>
          <Button 
            variant="primary"
            onClick={handleExport}
          >
            Exportar Paquetes
          </Button>
        </div>
      </div>

      <div className="tab-content">
        <WorkPackagesManagement workPackages={workPackages} onChange={onChange} />
      </div>
    </div>
  );
};

export default WorkPackagesTab;