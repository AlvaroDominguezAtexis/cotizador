// src/components/tabs/WorkPackagesTab.tsx

import React from 'react';
import { getProjectYears } from '../../utils/functions';
import { Button } from '../ui/Button';
import WorkPackagesManagement from '../workpackages/WorkPackagesManagement';
import TimeAndMaterialForm from '../workpackages/TimeAndMaterialForm';
import { createTimeAndMaterialWorkPackage } from '../../api/timeAndMaterialApi';
import './Tabs.css';

interface WorkPackagesTabProps {
  workPackages: any[]; // kept for backward compatibility but ignored in favor of backend data
  onChange: (workPackages: any[]) => void;
  projectStartDate?: string;
  projectEndDate?: string;
  projectId?: number;
  iqp?: number;                                    // 🔹 IQP del proyecto
  marginGoal?: number;                             // 🔹 Margin goal del proyecto
  profiles?: { id: number; name: string }[];       // 🔹 Perfiles (id, name)
  countries?: { id: string; name: string }[];      // 🔹 Países (id, name)
}

export const WorkPackagesTab: React.FC<WorkPackagesTabProps> = ({ 
  workPackages, 
  onChange, 
  projectStartDate, 
  projectEndDate, 
  projectId, 
  iqp = 3,
  marginGoal = 0,
  profiles = [], 
  countries = [] 
}) => {
  const years = getProjectYears(projectStartDate, projectEndDate);
  
  const handleTimeAndMaterialSave = async (data: any) => {
    try {
      const result = await createTimeAndMaterialWorkPackage(data);
      console.log('Time & Material workpackage created:', result);
      // Refresh workpackages list
      onChange([...workPackages]);
    } catch (error) {
      console.error('Error creating Time & Material:', error);
      throw error;
    }
  };

  // Si el proyecto es IQP 1 o 2, mostrar la versión simplificada
  if (iqp === 1 || iqp === 2) {
    return (
      <div className="tab-container">
        <div className="tab-header">
          <h1>Configuración Time & Material (IQP {iqp})</h1>
          <div className="tab-description">
            <p>Para proyectos IQP 1-2, configure directamente los perfiles sin estructuras de workpackages complejas.</p>
          </div>
        </div>

        <div className="tab-content">
          <TimeAndMaterialForm
            projectId={projectId!}
            profileOptions={profiles}
            countryOptions={countries}
            projectYears={years}
            defaultMarginGoal={marginGoal}
            projectStartDate={projectStartDate}
            projectEndDate={projectEndDate}
            onSave={handleTimeAndMaterialSave}
          />
        </div>
      </div>
    );
  }

  // Para IQP 3, 4, 5 - versión completa original
  // Para IQP 3, 4, 5 - versión completa original
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
        <h1>Paquetes de Trabajo (IQP {iqp})</h1>
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
        <WorkPackagesManagement
          workPackages={workPackages}
          onChange={onChange}
          projectYears={years}
          projectId={projectId}
          profileOptions={profiles}
          countryOptions={countries}
        />
      </div>
    </div>
  );
};

export default WorkPackagesTab;