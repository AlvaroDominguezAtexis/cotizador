// src/components/tabs/SummaryTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import SummaryDocument from '../summary/SummaryDocument';
import { recalcProjectStepsCosts } from '../../api/stepsApi';
import { recomputeItCosts } from '../../api/nonOperationalCosts';
import { recalcProjectMarginsYearlyApi } from '../../api/deliverablesApi';
import './Tabs.css';

interface SummaryTabProps {
  project: any;
  profiles: any[];
  workPackages: any[];
  costs: any;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ project, profiles, workPackages, costs }) => {
  const [loading, setLoading] = React.useState(false);
  const [recalcId, setRecalcId] = React.useState<number>(0);
  const [isRecalculating, setIsRecalculating] = React.useState(false);
  const [currentProgress, setCurrentProgress] = React.useState<string>('');

  // Manual recalculation function - efficient and user-controlled
  const handleRecalcCosts = async () => {
      if (!project?.id || loading) return;
      
      setLoading(true);
      setIsRecalculating(true);
      setCurrentProgress('Starting cost recalculation...');
      
      try {
        // Step 1: Recalculate project step costs
        setCurrentProgress('Recalculating project step costs...');
        await recalcProjectStepsCosts(project.id);
        
        // Step 2: Add delay to respect server rate limiting  
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Step 3: Recompute IT costs for current year
        setCurrentProgress('Recalculating IT costs...');
        
        // Get the current year or project year
        const currentYear = project?.startDate ? new Date(project.startDate).getFullYear() : new Date().getFullYear();
        await recomputeItCosts(project.id, currentYear);
        
        // Step 4: Add another delay before margins calculation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 5: Recalculate yearly margins
        setCurrentProgress('Recalculating project margins...');
        await recalcProjectMarginsYearlyApi(project.id);
        
        setCurrentProgress('Calculations completed successfully!');
        
      } catch (error: any) {
        console.error('Error during cost recalculation:', error);
        setCurrentProgress(`Error: ${error.message || 'Unknown error occurred'}`);
      } finally {
        setLoading(false);
        setIsRecalculating(false);
        setRecalcId(Date.now());
        // Clear progress message after a delay
        setTimeout(() => setCurrentProgress(''), 3000);
      }
    };

  const handleExport = () => {
    const summaryData = {
      project,
      workPackages,
      profiles,
      costs
    };
    const blob = new Blob([JSON.stringify(summaryData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumen_proyecto_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Project Summary</h1>
        
        {/* Manual recalculation button - only show when not loading */}
        {!loading && (
          <Button 
            variant="secondary"
            onClick={handleRecalcCosts}
            style={{ marginLeft: '10px' }}
          >
            Recalculate Costs
          </Button>
        )}
        
        {/* Show loading status */}
        {loading && (
          <span style={{ marginLeft: 10, color: '#666' }}>
            Recalculating costs...
            {currentProgress && (
              <span style={{ display: 'block', fontSize: '0.9em', fontStyle: 'italic', color: '#666', marginTop: '4px' }}>
                {currentProgress}
              </span>
            )}
          </span>
        )}
        
        <div className="tab-actions">
          <Button 
            variant="secondary"
            onClick={handlePrint}
          >
            Print Summary
          </Button>
          <Button 
            variant="primary"
            onClick={handleExport}
          >
            Export Summary
          </Button>
        </div>
      </div>

      <div >
        <div className="summary-main-content" style={{ width: '100%' }}>
          <Card>
            {/* Always render SummaryDocument, remount after recalculation for fresh data */}
            <SummaryDocument 
              key={recalcId || 'initial'} 
              project={project} 
              workPackages={workPackages} 
              profiles={profiles} 
              costs={costs} 
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;