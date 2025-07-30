import React from 'react';
import { License } from '../../types/license';
import { Button } from '../ui/Button';
import './LicenseTable.css';

interface LicenseTableProps {
  licenses: License[];
  onEdit: (license: License) => void;
  onDelete: (licenseId: number) => void;
}

const LicenseTable: React.FC<LicenseTableProps> = ({ 
  licenses, 
  onEdit, 
  onDelete 
}) => {
  // Mapeo de tipos de licencia
  const getLicenseTypeLabel = (type?: License['type']) => {
    switch (type) {
      case 'software': return 'Software';
      case 'hardware': return 'Hardware';
      case 'service': return 'Servicio';
      case 'other': return 'Otro';
      default: return 'N/A';
    }
  };

  if (licenses.length === 0) {
    return (
      <div className="empty-licenses-table">
        <p>No hay licencias registradas</p>
      </div>
    );
  }

  return (
    <div className="license-table-container">
      <table className="license-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Coste</th>
            <th>Proyecto Completo</th>
            <th>Proveedor</th>
            <th>Fecha Renovación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {licenses.map(license => (
            <tr key={license.id}>
              <td>{license.name}</td>
              <td>{getLicenseTypeLabel(license.type)}</td>
              <td>€{license.cost.toFixed(2)}</td>
              <td>{license.fullProjectCost ? 'Sí' : 'No'}</td>
              <td>{license.provider || 'N/A'}</td>
              <td>{license.renewalDate || 'N/A'}</td>
              <td className="license-actions">
                <Button 
                  variant="primary" 
                  size="sm"
                  onClick={() => onEdit(license)}
                >
                  Editar
                </Button>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => onDelete(license.id)}
                >
                  Eliminar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LicenseTable;