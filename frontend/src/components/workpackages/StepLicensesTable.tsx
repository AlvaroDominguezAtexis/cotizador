import React, { useState } from 'react';
import { StepLicense } from '../../types/workPackages';
import { Button } from '../ui/Button';
import './WorkPackages.css';

interface Props {
  licenses: StepLicense[];
  onUpdate: (licenses: StepLicense[]) => void;
}

const StepLicensesTable: React.FC<Props> = ({ licenses, onUpdate }) => {
  const [editingLicense, setEditingLicense] = useState<Partial<StepLicense> | null>(null);

  const handleSave = () => {
    if (!editingLicense || !editingLicense.name?.trim()) return;

    let updatedLicenses = [...licenses];

    if (!editingLicense.id) {
      const newLicense: StepLicense = {
        ...editingLicense,
        id: Date.now(),
        cost: editingLicense.cost || 0,
        assigned: editingLicense.assigned || false
      } as StepLicense;
      updatedLicenses.push(newLicense);
    } else {
      updatedLicenses = updatedLicenses.map((l) =>
        l.id === editingLicense.id ? (editingLicense as StepLicense) : l
      );
    }

    onUpdate(updatedLicenses);
    setEditingLicense(null);
  };

  const handleDelete = (id: number) => {
    const updated = licenses.filter((l) => l.id !== id);
    onUpdate(updated);
  };

  const handleCancel = () => setEditingLicense(null);

  return (
    <table className="table licenses-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Cost (€)</th>
          <th>Assigned</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {licenses.map((license) => (
          <tr key={license.id} className={editingLicense?.id === license.id ? 'new-row' : ''}>
            <td>
              {editingLicense?.id === license.id ? (
                <input
                  value={editingLicense.name || ''}
                  onChange={(e) =>
                    setEditingLicense({ ...editingLicense, name: e.target.value })
                  }
                  className="wp-input"
                />
              ) : (
                license.name
              )}
            </td>
            <td>
              {editingLicense?.id === license.id ? (
                <input
                  type="number"
                  value={editingLicense.cost || 0}
                  onChange={(e) =>
                    setEditingLicense({ ...editingLicense, cost: Number(e.target.value) })
                  }
                  className="wp-input"
                />
              ) : (
                license.cost.toFixed(2)
              )}
            </td>
            <td>
              {editingLicense?.id === license.id ? (
                <input
                  type="checkbox"
                  checked={editingLicense.assigned || false}
                  onChange={(e) =>
                    setEditingLicense({ ...editingLicense, assigned: e.target.checked })
                  }
                />
              ) : license.assigned ? (
                '✔'
              ) : (
                '✖'
              )}
            </td>
            <td className="table-row-actions">
              {editingLicense?.id === license.id ? (
                <>
                  <Button variant="success" size="sm" onClick={handleSave}>
                    Save
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={() => setEditingLicense({ ...license })}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(license.id)}>
                    Delete
                  </Button>
                </>
              )}
            </td>
          </tr>
        ))}

        {!editingLicense && (
          <tr className="new-row">
            <td colSpan={4}>
              <Button variant="secondary" size="sm" onClick={() => setEditingLicense({})}>
                + Add License
              </Button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default StepLicensesTable;
