import React, { useState } from 'react';
import { useProject } from '../../hooks/useProject';
import { License } from '../../types/license';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table } from '../ui/Table';
import EmptyState from '../ui/EmptyState';
import Card from '../ui/Card';

export const LicensesList: React.FC = () => {
  const { licenses, addLicense, updateLicense, deleteLicense } = useProject();
  const [isAddingLicense, setIsAddingLicense] = useState(false);
  const [newLicense, setNewLicense] = useState<Partial<License>>({
    name: '',
    cost: 0,
    fullProjectCost: false
  });

  const handleAddLicense = () => {
    if (!newLicense.name) {
      alert('Por favor, introduce un nombre para la licencia');
      return;
    }

    const licenseToAdd: License = {
      id: Date.now(), // Generar ID único
      name: newLicense.name || '',
      cost: newLicense.cost || 0,
      fullProjectCost: newLicense.fullProjectCost || false
    };

    addLicense(licenseToAdd);
    
    // Resetear estado
    setNewLicense({
      name: '',
      cost: 0,
      fullProjectCost: false
    });
    setIsAddingLicense(false);
  };

  const columns = [
    {
      key: 'name',
      title: 'Nombre',
      render: (value: string, record: License) => (
        <Input
          type="text"
          value={value}
          onChange={(e) => updateLicense(record.id, { name: e.target.value })}
        />
      )
    },
    {
      key: 'cost',
      title: 'Coste (€)',
      render: (value: number, record: License) => (
        <Input
          type="number"
          value={value}
          onChange={(e) => updateLicense(record.id, { cost: Number(e.target.value) })}
          className="text-right"
        />
      )
    },
    {
      key: 'fullProjectCost',
      title: 'Coste Completo de Proyecto',
      render: (value: boolean, record: License) => (
        <Input
          type="checkbox"
          checked={value}
          onChange={(e) => updateLicense(record.id, { fullProjectCost: e.target.checked })}
        />
      )
    },
    {
      key: 'actions',
      title: 'Acciones',
      render: (_: any, record: License) => (
        <Button 
          variant="danger" 
          size="sm"
          onClick={() => deleteLicense(record.id)}
        >
          Eliminar
        </Button>
      )
    }
  ];

  if (licenses.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No hay licencias"
          description="Añade tu primera licencia para comenzar"
          action={
            <Button 
              variant="primary" 
              onClick={() => setIsAddingLicense(true)}
            >
              Añadir Licencia
            </Button>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Licencias</h2>
        <Button 
          variant="success" 
          onClick={() => setIsAddingLicense(true)}
        >
          Añadir Licencia
        </Button>
      </div>

      {/* Modal/Formulario para añadir nueva licencia */}
      {isAddingLicense && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Nueva Licencia</h3>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Nombre de la Licencia"
              value={newLicense.name || ''}
              onChange={(e) => setNewLicense(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ej: Adobe Creative Cloud"
            />
            <Input
              label="Coste"
              type="number"
              value={newLicense.cost || 0}
              onChange={(e) => setNewLicense(prev => ({ ...prev, cost: Number(e.target.value) }))}
              placeholder="0.00"
            />
            <div className="flex items-center pt-6">
              <Input
                type="checkbox"
                label="Coste Completo de Proyecto"
                checked={newLicense.fullProjectCost || false}
                onChange={(e) => setNewLicense(prev => ({ ...prev, fullProjectCost: e.target.checked }))}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="primary" 
              onClick={handleAddLicense}
            >
              Guardar Licencia
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setIsAddingLicense(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Table
        data={licenses}
        columns={columns}
        rowKey="id"
        title="Listado de Licencias"
        description="Gestiona las licencias asociadas a tu proyecto"
      />
    </Card>
  );
};

export default LicensesList;