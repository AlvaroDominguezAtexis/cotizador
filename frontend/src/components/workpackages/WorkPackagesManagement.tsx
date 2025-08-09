import React, { useState } from 'react';
import { useProject } from '../../hooks/useProject';
import { WorkPackage } from '../../types/workPackages';
import Card from '../ui/Card';
import { Button } from '../ui/Button';
import WorkPackagesTable from './WorkPackagesTable';
import './WorkPackages.css';


interface WorkPackagesManagementProps {
  workPackages: any[];
  onChange: (workPackages: any[]) => void;
  projectYears?: number[];
}

const WorkPackagesManagement: React.FC<WorkPackagesManagementProps> = ({ workPackages, onChange, projectYears = [] }) => {
  const [tableData, setTableData] = useState<any[]>(workPackages);
  const [creatingNew, setCreatingNew] = useState(false);




  const handleAdd = (wp: any) => {
    const updated = [...tableData, wp];
    setTableData(updated);
    onChange(updated);
    setCreatingNew(false);
  };

  const handleUpdate = (wp: any) => {
    const updated = tableData.map((p) => (p.id === wp.id ? wp : p));
    setTableData(updated);
    onChange(updated);
  };

  const handleDelete = (id: number) => {
    const updated = tableData.filter((p) => p.id !== id);
    setTableData(updated);
    onChange(updated);
  };

  const handleCancelCreate = () => {
    setCreatingNew(false);
  };

  return (
    <Card>
      <div className="work-packages-header">
        <Button
          variant="success"
          size="sm"
          onClick={() => setCreatingNew(true)}
          disabled={creatingNew}
        >
          Añadir Paquete de Trabajo
        </Button>
      </div>
      <WorkPackagesTable
        data={tableData}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        createNew={creatingNew}
        onCancelCreate={handleCancelCreate}
        projectYears={projectYears}
      />
    </Card>
  );
};

export default WorkPackagesManagement;

