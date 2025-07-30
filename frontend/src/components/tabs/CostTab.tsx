// src/components/tabs/CostsTab.tsx

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import TravelCosts from '../costs/TravelCosts';
import { SubcontractCosts } from '../costs/SubcontractCosts';
import { ITCosts } from '../costs/ITCosts';
import { OtherCosts } from '../costs/OtherCosts';
import './Tabs.css';

interface CostsTabProps {
  costs: any;
  onChange: (costs: any) => void;
}

export const CostsTab: React.FC<CostsTabProps> = ({ costs, onChange }) => {
  const [activeSubTab, setActiveSubTab] = useState<'travel' | 'subcontract' | 'it' | 'other'>('travel');

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(costs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `costes_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            onChange(importedCosts);
          } catch (error) {
            alert('Error al importar costes. Formato de archivo inválido.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  // You can expand this to pass onChange to each sub-costs component

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
          <Button
            variant={activeSubTab === 'other' ? 'primary' : 'secondary'}
            onClick={() => setActiveSubTab('other')}
          >
            Otros Gastos
          </Button>
        </div>

        <div className="tab-content">
          {/* You can pass onChange to these components for granular updates */}
          {activeSubTab === 'travel' && <TravelCosts />}
          {activeSubTab === 'subcontract' && <SubcontractCosts />}
          {activeSubTab === 'it' && <ITCosts />}
          {activeSubTab === 'other' && <OtherCosts />}
        </div>
      </div>
    </div>
  );
};

export default CostsTab;