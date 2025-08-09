// src/components/tabs/CostsTab.tsx
import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { NonOperationalCosts } from '../costs/NonOperationalCosts';
import { NonOperationalCost } from '../../types/costs';
import './Tabs.css';

interface CostsTabProps {
  costs: NonOperationalCost[];
  onChange: (costs: NonOperationalCost[]) => void;
}

export const CostsTab: React.FC<CostsTabProps> = ({ costs, onChange }) => {
  const [activeSubTab, setActiveSubTab] = useState<'travel' | 'subcontract' | 'it'>('travel');

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(costs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `costes_no_operacionales_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar costes:', error);
      alert('Hubo un error al exportar los costes. Inténtelo de nuevo.');
    }
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
            const importedCosts = JSON.parse(event.target?.result as string);
            
            // Validar estructura de costes
            if (Array.isArray(importedCosts) && 
                importedCosts.every(cost => 
                  cost.id && 
                  cost.type && 
                  ['it', 'subcontract', 'travel'].includes(cost.context)
                )) {
              // Usar método de onChange para importar
              onChange(importedCosts);
            } else {
              throw new Error('Formato de archivo inválido');
            }
          } catch (error) {
            console.error('Error al importar costes:', error);
            alert('Error al importar costes. Formato de archivo inválido.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // Filtrar costes por contexto actual
  const filteredCosts = costs.filter(cost => cost.context === activeSubTab);

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Costes No Operacionales</h1>
        <div className="tab-actions">
          <Button 
            variant="secondary"
            onClick={handleImport}
          >
            Importar Costes
          </Button>
          <Button 
            variant="primary"
            onClick={handleExport}
          >
            Exportar Costes
          </Button>
        </div>
      </div>

      {/* Subtabs de costes */}
      <div className="costs-subtabs">
        <div className="costs-subtab-navigation">
          <Button
            variant={activeSubTab === 'travel' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubTab('travel')}
          >
            Viajes
          </Button>
          <Button
            variant={activeSubTab === 'subcontract' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubTab('subcontract')}
          >
            Subcontrata
          </Button>
          <Button
            variant={activeSubTab === 'it' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubTab('it')}
          >
            Infraestructura IT
          </Button>
        </div>

        <div className="tab-content">
          <NonOperationalCosts 
            context={activeSubTab}
            costs={filteredCosts}
            onChange={(updatedCosts: NonOperationalCost[]) => {
              // Reemplazar los costes del contexto actual
              const updatedAllCosts: NonOperationalCost[] = costs.filter((cost: NonOperationalCost) => cost.context !== activeSubTab)
          .concat(updatedCosts);
              onChange(updatedAllCosts);
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Exportación por defecto para compatibilidad
export default CostsTab;