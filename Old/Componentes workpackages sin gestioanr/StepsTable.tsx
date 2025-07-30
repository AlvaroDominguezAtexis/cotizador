import React, { useState } from 'react';
import {Button} from '../ui/Button';
import { Step } from '../../types/project';
import { useProject } from '../../hooks/useProject';
import StepLicensesModal from './StepLicensesModal';
import './StepsTable.css';

interface StepsTableProps {
  steps: Step[];
  onUpdateStep: (updatedStep: Step) => void;
  onDeleteStep: (stepId: number) => void;
}

const StepsTable: React.FC<StepsTableProps> = ({
  steps,
  onUpdateStep,
  onDeleteStep
}) => {
  const { projectData, profiles, licenses } = useProject();
  const [selectedStepForLicenses, setSelectedStepForLicenses] = useState<Step | null>(null);

  // Obtener países del proyecto
  const getProjectCountries = () => {
    if (!projectData.scope) return ['españa'];
    
    if (projectData.scope === 'local') {
      return [projectData.country || 'españa'];
    }
    
    const countries = [projectData.country || 'españa'];
    
    if (projectData.additionalCountries) {
      projectData.additionalCountries.forEach(country => {
        if (!countries.includes(country)) {
          countries.push(country);
        }
      });
    }
    
    return countries;
  };

  // Manejar cambios en los campos del step
  const handleStepChange = (stepId: number, field: keyof Step, value: any) => {
    const updatedStep = steps.find(s => s.id === stepId);
    
    if (updatedStep) {
      const newStep = {
        ...updatedStep,
        [field]: value
      };
      
      onUpdateStep(newStep);
    }
  };

  // Abrir modal de licencias
  const openLicensesModal = (step: Step) => {
    setSelectedStepForLicenses(step);
  };

  // Cerrar modal de licencias
  const closeLicensesModal = () => {
    setSelectedStepForLicenses(null);
  };

  // Actualizar licencias de un step
  const handleUpdateStepLicenses = (licenses: number[]) => {
    if (selectedStepForLicenses) {
      const updatedStep = {
        ...selectedStepForLicenses,
        licenses
      };
      
      onUpdateStep(updatedStep);
      closeLicensesModal();
    }
  };

  return (
    <div className="steps-table-container">
      <table className="steps-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Perfil</th>
            <th>País</th>
            <th>Tiempo</th>
            <th>Unidades</th>
            <th>Office</th>
            <th>IT</th>
            <th>% Mng</th>
            <th>% NPT</th>
            <th>Licencias</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {steps.map(step => (
            <tr key={step.id}>
              <td>
                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => handleStepChange(step.id, 'name', e.target.value)}
                  placeholder="Nombre del step"
                />
              </td>
              <td>
                <select
                  value={step.profile}
                  onChange={(e) => handleStepChange(step.id, 'profile', e.target.value)}
                >
                  <option value="">Seleccionar...</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={step.country}
                  onChange={(e) => handleStepChange(step.id, 'country', e.target.value)}
                >
                  <option value="">País...</option>
                  {getProjectCountries().map(country => (
                    <option key={country} value={country}>
                      {country.charAt(0).toUpperCase() + country.slice(1)}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={step.processTime}
                  onChange={(e) => handleStepChange(
                    step.id, 
                    'processTime', 
                    parseFloat(e.target.value) || 0
                  )}
                  min="0"
                  step="0.5"
                />
              </td>
              <td>
                <select
                  value={step.timeUnits}
                  onChange={(e) => handleStepChange(step.id, 'timeUnits', e.target.value)}
                >
                  <option value="horas">Horas</option>
                  <option value="dias">Días</option>
                  <option value="meses">Meses</option>
                </select>
              </td>
              <td>
                <select
                  value={step.office ? 'true' : 'false'}
                  onChange={(e) => handleStepChange(
                    step.id, 
                    'office', 
                    e.target.value === 'true'
                  )}
                >
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </td>
              <td>
                <select
                  value={step.it ? 'true' : 'false'}
                  onChange={(e) => handleStepChange(
                    step.id, 
                    'it', 
                    e.target.value === 'true'
                  )}
                >
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={step.mngPercent}
                  onChange={(e) => handleStepChange(
                    step.id, 
                    'mngPercent', 
                    parseFloat(e.target.value) || 0
                  )}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={step.nptPercent}
                  onChange={(e) => handleStepChange(
                    step.id, 
                    'nptPercent', 
                    parseFloat(e.target.value) || 0
                  )}
                  min="0"
                  max="100"
                  step="0.1"
                />
              </td>
              <td>
                <Button 
                  variant="outline-secondary" 
                  size="sm"
                  onClick={() => openLicensesModal(step)}
                >
                  {step.licenses?.length || 0} 📝
                </Button>
              </td>
              <td>
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => onDeleteStep(step.id)}
                >
                  🗑️
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de Licencias */}
      {selectedStepForLicenses && (
        <StepLicensesModal
          step={selectedStepForLicenses}
          licenses={licenses}
          onClose={closeLicensesModal}
          onSave={handleUpdateStepLicenses}
        />
      )}
    </div>
  );
};

export default StepsTable;