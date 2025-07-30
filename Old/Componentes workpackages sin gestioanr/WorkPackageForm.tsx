// src/components/workpackages/WorkPackageForm.tsx
import React, { useState, useEffect } from 'react';
import { WorkPackage, Deliverable } from '../../types/project';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { COUNTRIES } from '../../types/common';

interface WorkPackageFormProps {
  initialWorkPackage?: WorkPackage | null;
  onSubmit: (workPackage: WorkPackage) => void;
  onCancel: () => void;
}

export const WorkPackageForm: React.FC<WorkPackageFormProps> = ({ 
  initialWorkPackage, 
  onSubmit, 
  onCancel 
}) => {
  const [name, setName] = useState(initialWorkPackage?.name || '');
  const [deliverables, setDeliverables] = useState<Deliverable[]>(
    initialWorkPackage?.deliverables || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('El nombre del paquete de trabajo es obligatorio');
      return;
    }

    const workPackageToSubmit: WorkPackage = {
      id: initialWorkPackage?.id || Date.now(),
      name,
      deliverables: deliverables.map(deliverable => ({
        ...deliverable,
        id: deliverable.id || Date.now() + Math.random()
      }))
    };

    onSubmit(workPackageToSubmit);
  };

  // Añadir un nuevo entregable
  const addDeliverable = () => {
    const newDeliverable: Deliverable = {
      id: Date.now(),
      name: '',
      margin: 0,
      yearlyQuantities: {},
      steps: []
    };
    setDeliverables([...deliverables, newDeliverable]);
  };

  // Actualizar un entregable
  const updateDeliverable = (index: number, updates: Partial<Deliverable>) => {
    const newDeliverables = [...deliverables];
    newDeliverables[index] = {
      ...newDeliverables[index],
      ...updates
    };
    setDeliverables(newDeliverables);
  };

  // Eliminar un entregable
  const removeDeliverable = (index: number) => {
    const newDeliverables = deliverables.filter((_, i) => i !== index);
    setDeliverables(newDeliverables);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">
        {initialWorkPackage ? 'Editar' : 'Nuevo'} Paquete de Trabajo
      </h2>

      <div className="space-y-4">
        <Input
          label="Nombre del Paquete de Trabajo"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Desarrollo de Software, Diseño UX"
          required
          fullWidth
        />

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Entregables</h3>
          {deliverables.map((deliverable, index) => (
            <div key={deliverable.id} className="border p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nombre del Entregable"
                  type="text"
                  value={deliverable.name}
                  onChange={(e) => updateDeliverable(index, { name: e.target.value })}
                  placeholder="Nombre del entregable"
                  required
                />
                <Input
                  label="Margen"
                  type="number"
                  value={deliverable.margin}
                  onChange={(e) => updateDeliverable(index, { margin: Number(e.target.value) })}
                  placeholder="Margen"
                  min={0}
                  max={100}
                />
              </div>

              <div>
                <h4 className="text-md font-medium mb-2">Cantidades Anuales</h4>
                <div className="grid grid-cols-3 gap-3">
                  {COUNTRIES.map(country => (
                    <Input
                      key={country.code}
                      label={country.name}
                      type="number"
                      value={deliverable.yearlyQuantities[country.code] || 0}
                      onChange={(e) => {
                        const updatedQuantities = {
                          ...deliverable.yearlyQuantities,
                          [country.code]: Number(e.target.value)
                        };
                        updateDeliverable(index, { yearlyQuantities: updatedQuantities });
                      }}
                      placeholder="Cantidad"
                      min={0}
                    />
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="danger"
                onClick={() => removeDeliverable(index)}
              >
                Eliminar Entregable
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            onClick={addDeliverable}
          >
            + Añadir Entregable
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button 
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button 
            type="submit"
            variant="primary"
          >
            {initialWorkPackage ? 'Actualizar' : 'Crear'} Paquete de Trabajo
          </Button>
        </div>
      </div>
    </form>
  );
};

export default WorkPackageForm;