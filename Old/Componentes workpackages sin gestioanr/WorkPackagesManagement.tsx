// src/components/workpackages/WorkPackagesManagement.tsx
import React, { useState } from 'react';
import { useProject } from '../../hooks/useProject';
import { WorkPackage } from '../../types/project';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import WorkPackagesList from './WorkPackagesList';
import { WorkPackageForm } from './WorkPackageForm';

export const WorkPackagesManagement: React.FC = () => {
  const { 
    workPackages, 
    addWorkPackage, 
    updateWorkPackage,
    deleteWorkPackage 
  } = useProject();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkPackage, setEditingWorkPackage] = useState<WorkPackage | null>(null);

  // Manejar adición de nuevo paquete de trabajo
  const handleAddWorkPackage = (newWorkPackage: WorkPackage) => {
    addWorkPackage(newWorkPackage);
    setIsFormOpen(false);
    setEditingWorkPackage(null);
  };

  // Manejar edición de paquete de trabajo
  const handleEditWorkPackage = (workPackage: WorkPackage) => {
    setEditingWorkPackage(workPackage);
    setIsFormOpen(true);
  };

  // Estado vacío
  if (workPackages.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay paquetes de trabajo"
          description="Añade tu primer paquete de trabajo"
          action={
            <Button 
              variant="primary" 
              onClick={() => setIsFormOpen(true)}
            >
              Añadir Paquete de Trabajo
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Paquetes de Trabajo</h2>
        <Button 
          variant="success" 
          onClick={() => {
            setEditingWorkPackage(null);
            setIsFormOpen(true);
          }}
        >
          + Añadir Paquete
        </Button>
      </div>

      {/* Lista de Paquetes de Trabajo */}
      <WorkPackagesList 
        workPackages={workPackages}
        onAddWorkPackage={() => {
          setEditingWorkPackage(null);
          setIsFormOpen(true);
        }}
        onDeleteWorkPackage={deleteWorkPackage}
        onUpdateWorkPackage={handleEditWorkPackage}
        onAddDeliverable={() => { /* TODO: implement add deliverable logic */ }}
      />

      {/* Formulario modal para añadir/editar paquete de trabajo */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <WorkPackageForm
              initialWorkPackage={editingWorkPackage}
              onSubmit={handleAddWorkPackage}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingWorkPackage(null);
              }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};

export default WorkPackagesManagement;