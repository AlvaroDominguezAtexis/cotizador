import React, { useState, useEffect } from 'react';
import {Button} from '../ui/Button';
import { Step } from '../../types/project';
import { License } from '../../types/license';
import './StepLicensesModal.css';

interface StepLicensesModalProps {
  step: Step;
  licenses: License[];
  onClose: () => void;
  onSave: (selectedLicenses: number[]) => void;
}

const StepLicensesModal: React.FC<StepLicensesModalProps> = ({
  step,
  licenses,
  onClose,
  onSave
}) => {
  // Estado para licencias seleccionadas
  const [selectedLicenses, setSelectedLicenses] = useState<number[]>(
    step.licenses || []
  );

  // Estado para filtrado de licencias
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar licencias disponibles
  const filteredLicenses = licenses.filter(license => 
    license.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Manejar selección/deselección de licencia
  const toggleLicenseSelection = (licenseId: number) => {
    setSelectedLicenses(prev => 
      prev.includes(licenseId)
        ? prev.filter(id => id !== licenseId)
        : [...prev, licenseId]
    );
  };

  // Manejar guardar licencias
  const handleSave = () => {
    onSave(selectedLicenses);
  };

  // Calcular total de costes de licencias
  const calculateTotalLicenseCost = () => {
    return selectedLicenses.reduce((total, licenseId) => {
      const license = licenses.find(l => l.id === licenseId);
      return total + (license?.cost || 0);
    }, 0);
  };

  return (
    <div className="step-licenses-modal-overlay">
      <div className="step-licenses-modal">
        <div className="step-licenses-modal-header">
          <h3>Licencias para: {step.name || `Step ${step.id}`}</h3>
          <button 
            className="step-licenses-modal-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="step-licenses-search">
          <input 
            type="text"
            placeholder="Buscar licencias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Lista de Licencias */}
        <div className="step-licenses-list">
          {filteredLicenses.length === 0 ? (
            <div className="step-licenses-empty">
              No se encontraron licencias
            </div>
          ) : (
            filteredLicenses.map(license => (
              <div 
                key={license.id} 
                className={`step-licenses-item ${
                  selectedLicenses.includes(license.id) ? 'selected' : ''
                }`}
                onClick={() => toggleLicenseSelection(license.id)}
              >
                <div className="step-licenses-item-checkbox">
                  <input 
                    type="checkbox"
                    checked={selectedLicenses.includes(license.id)}
                    onChange={() => toggleLicenseSelection(license.id)}
                  />
                </div>
                <div className="step-licenses-item-details">
                  <div className="step-licenses-item-name">
                    {license.name}
                  </div>
                  <div className="step-licenses-item-cost">
                    €{license.cost.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen de Licencias */}
        <div className="step-licenses-summary">
          <div className="step-licenses-summary-item">
            <strong>Licencias Seleccionadas:</strong> {selectedLicenses.length}
          </div>
          <div className="step-licenses-summary-item">
            <strong>Coste Total:</strong> €{calculateTotalLicenseCost().toFixed(2)}
          </div>
        </div>

        {/* Acciones */}
        <div className="step-licenses-modal-actions">
          <Button 
            variant="secondary" 
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSave}
          >
            Guardar Licencias
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StepLicensesModal;