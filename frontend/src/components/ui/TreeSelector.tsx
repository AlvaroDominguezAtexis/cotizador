import React, { useState, useEffect } from 'react';
import { WorkPackage, Deliverable, Step } from '../../types/workPackages';
import './TreeSelector.css';

interface TreeSelectorProps {
  workPackages: WorkPackage[];
  selectedStepIds: number[];
  onChange: (stepIds: number[]) => void;
  editable?: boolean; // when false, render read-only indicators instead of checkboxes
}

const getStepIdsFromWorkPackage = (wp: WorkPackage): number[] => {
  return wp.deliverables?.flatMap(d => d.steps?.map(s => s.id) || []) || [];
};

const getStepIdsFromDeliverable = (d: Deliverable): number[] => {
  return d.steps?.map(s => s.id) || [];
};

export const TreeSelector: React.FC<TreeSelectorProps> = ({ workPackages, selectedStepIds, onChange, editable = true }) => {
  const [expandedWPs, setExpandedWPs] = useState<number[]>([]);
  const [expandedDeliverables, setExpandedDeliverables] = useState<number[]>([]);
  const [warning, setWarning] = useState<{ target: string; text: string } | null>(null);

  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 4000);
    return () => clearTimeout(t);
  }, [warning]);

  const toggleWP = (wpId: number) => {
    setExpandedWPs(prev => 
      prev.includes(wpId) 
        ? prev.filter(id => id !== wpId)
        : [...prev, wpId]
    );
  };

  const toggleDeliverable = (delId: number) => {
    setExpandedDeliverables(prev =>
      prev.includes(delId)
        ? prev.filter(id => id !== delId)
        : [...prev, delId]
    );
  };

  const handleSelectAll = () => {
    const allStepIds = workPackages.flatMap(getStepIdsFromWorkPackage);
    onChange(allStepIds);
  };

  const handleWorkPackageSelect = (wp: WorkPackage) => {
    const stepIds = getStepIdsFromWorkPackage(wp);
    if (!stepIds.length) {
      // Show inline warning and do not allow selecting a WP without steps
      setWarning({ target: `wp-${wp.id}`, text: `you can't associate a cost to this "Workpackage: ${wp.name}" as there are not associated steps` });
      return;
    }
    const allSelected = stepIds.every(id => selectedStepIds.includes(id));
    
    if (allSelected) {
      onChange(selectedStepIds.filter(id => !stepIds.includes(id)));
    } else {
      const uniqueStepIds = Array.from(new Set([...selectedStepIds, ...stepIds]));
      onChange(uniqueStepIds);
    }
  };

  const handleDeliverableSelect = (del: Deliverable) => {
    const stepIds = getStepIdsFromDeliverable(del);
    if (!stepIds.length) {
      // Show inline warning and do not allow selecting a deliverable without steps
      setWarning({ target: `del-${del.id}`, text: `you can't associate a cost to this "Deliverable: ${del.name}" as there are not associated steps` });
      return;
    }
    const allSelected = stepIds.every(id => selectedStepIds.includes(id));
    
    if (allSelected) {
      onChange(selectedStepIds.filter(id => !stepIds.includes(id)));
    } else {
      const uniqueStepIds = Array.from(new Set([...selectedStepIds, ...stepIds]));
      onChange(uniqueStepIds);
    }
  };

  const handleStepSelect = (stepId: number) => {
    if (selectedStepIds.includes(stepId)) {
      onChange(selectedStepIds.filter(id => id !== stepId));
    } else {
      onChange([...selectedStepIds, stepId]);
    }
  };

  const isWPSelected = (wp: WorkPackage) => {
    const stepIds = getStepIdsFromWorkPackage(wp);
    return stepIds.length > 0 && stepIds.every(id => selectedStepIds.includes(id));
  };

  const isDeliverableSelected = (del: Deliverable) => {
    const stepIds = getStepIdsFromDeliverable(del);
    return stepIds.length > 0 && stepIds.every(id => selectedStepIds.includes(id));
  };

  return (
    <div className="tree-selector">
      <div className="tree-item">
        {editable ? (
          <input
            type="checkbox"
            checked={workPackages.flatMap(getStepIdsFromWorkPackage).every(id => selectedStepIds.includes(id))}
            onChange={handleSelectAll}
          />
        ) : (
          <span className={`readonly-check ${workPackages.flatMap(getStepIdsFromWorkPackage).every(id => selectedStepIds.includes(id)) ? 'checked' : ''}`} />
        )}
        <span><span className="category-label">Project:</span> Entire Project</span>
      </div>
      
      {workPackages.map(wp => (
        <div key={wp.id} className="tree-wp">
          <div className="tree-item">
            <button className="expand-button" onClick={() => toggleWP(wp.id)}>
              {expandedWPs.includes(wp.id) ? '▼' : '▶'}
            </button>
            {editable ? (
              <input
                type="checkbox"
                checked={isWPSelected(wp)}
                onChange={() => handleWorkPackageSelect(wp)}
              />
            ) : (
              <span className={`readonly-check ${isWPSelected(wp) ? 'checked' : ''}`} />
            )}
            <span><span className="category-label">Workpackage:</span> {wp.name}</span>
          </div>
          {warning?.target === `wp-${wp.id}` && (
            <div className="tree-warning" role="status" aria-live="polite">{warning.text}</div>
          )}
          
          {expandedWPs.includes(wp.id) && wp.deliverables?.map(del => (
            <div key={del.id} className="tree-deliverable">
              <div className="tree-item">
                <button className="expand-button" onClick={() => toggleDeliverable(del.id)}>
                  {expandedDeliverables.includes(del.id) ? '▼' : '▶'}
                </button>
                {editable ? (
                  <input
                    type="checkbox"
                    checked={isDeliverableSelected(del)}
                    onChange={() => handleDeliverableSelect(del)}
                  />
                ) : (
                  <span className={`readonly-check ${isDeliverableSelected(del) ? 'checked' : ''}`} />
                )}
                <span><span className="category-label">Deliverable:</span> {del.name}</span>
              </div>
              {warning?.target === `del-${del.id}` && (
                <div className="tree-warning" role="status" aria-live="polite">{warning.text}</div>
              )}
              
              {expandedDeliverables.includes(del.id) && del.steps?.map(step => (
                <div key={step.id} className="tree-step">
                  <div className="tree-item">
                    <span className="expand-placeholder"></span>
                    {editable ? (
                      <input
                        type="checkbox"
                        checked={selectedStepIds.includes(step.id)}
                        onChange={() => handleStepSelect(step.id)}
                      />
                    ) : (
                      <span className={`readonly-check ${selectedStepIds.includes(step.id) ? 'checked' : ''}`} />
                    )}
                    <span><span className="category-label">Step:</span> {step.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
