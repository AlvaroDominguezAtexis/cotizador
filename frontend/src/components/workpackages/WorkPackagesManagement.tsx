import React, { useState, useEffect } from 'react';
import { useProject } from '../../hooks/useProject';
import { WorkPackage } from '../../types/workPackages';
import Card from '../ui/Card';
import { Button } from '../ui/Button';
import WorkPackagesTable from './WorkPackagesTable';
import './WorkPackages.css';
import useWorkPackages from '../../hooks/useWorkPackages';

interface WorkPackagesManagementProps {
  workPackages: any[];
  onChange: (workPackages: any[]) => void;
  projectYears?: number[];
  projectId?: number | null; // allow passing explicit project id
  profiles?: string[];
  countries?: string[];
}

const WorkPackagesManagement: React.FC<WorkPackagesManagementProps> = ({ workPackages, onChange, projectYears = [], projectId, profiles = [], countries = [] }) => {
  // If projectId not provided, try to obtain from useProject hook if it exposes current project
  const { projectData } = useProject?.() || ({} as any);
  const effectiveProjectId = projectId ?? projectData?.id ?? null;
  const { workPackages: backendWPs, loading, error, createWP, updateWP, deleteWP } = useWorkPackages(effectiveProjectId);
  const [creatingNew, setCreatingNew] = useState(false);

  // Sync upward when backend list changes
  useEffect(() => {
    if (backendWPs && backendWPs.length !== workPackages.length) {
      onChange(backendWPs);
    }
  }, [backendWPs, onChange]);

  const handleAdd = async (wp: any) => {
    if (!effectiveProjectId) return;
    await createWP({ codigo: wp.code || wp.codigo || '', nombre: wp.name || wp.nombre || '', dm: Number(wp.DM || wp.dm || 0) });
    setCreatingNew(false);
  };

  const handleUpdate = async (wp: any) => {
    if (!effectiveProjectId) return;
    await updateWP(wp.id, { codigo: wp.code || wp.codigo, nombre: wp.name || wp.nombre, dm: Number(wp.DM || wp.dm || 0) });
  };

  const handleDelete = async (id: number) => {
    if (!effectiveProjectId) return;
    await deleteWP(id);
  };

  const handleCancelCreate = () => { setCreatingNew(false); };

  return (
    <Card>
      <div className="work-packages-header">
        <Button
          variant="success"
          size="sm"
          onClick={() => setCreatingNew(true)}
          disabled={creatingNew || !effectiveProjectId}
        >
          Añadir Paquete de Trabajo
        </Button>
        {loading && <span style={{ marginLeft: '1rem', fontSize: '.8rem' }}>Cargando...</span>}
        {error && <span style={{ marginLeft: '1rem', color: 'red', fontSize: '.8rem' }}>{error}</span>}
      </div>
      <WorkPackagesTable
        data={backendWPs}
        onAdd={handleAdd}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        createNew={creatingNew}
        onCancelCreate={handleCancelCreate}
        projectYears={projectYears}
  projectId={effectiveProjectId}
  profiles={profiles}
  countries={countries}
      />
    </Card>
  );
};

export default WorkPackagesManagement;

