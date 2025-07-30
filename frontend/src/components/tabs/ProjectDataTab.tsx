// src/components/tabs/ProjectDataTab.tsx

import React from 'react';
import { Button } from '../ui/Button';
import ProjectDataForm from '../forms/ProjectDataForm';
import { ProjectData } from '../../types/project';
import './Tabs.css';


interface ProjectDataTabProps {
  project?: ProjectData | null;
  onChange?: (data: ProjectData) => void;
  onBackToMenu?: () => void;
}


export const ProjectDataTab: React.FC<ProjectDataTabProps> = ({ project, onChange, onBackToMenu }) => {
  return (
    <div className="tab-container">
      <div className="tab-header">
        <h1>Información Básica del Proyecto</h1>
      </div>
      <div className="tab-content">
        <ProjectDataForm key={project?.id || 'new'} initialValues={project || undefined} onChange={onChange} />
      </div>
    </div>
  );
};

export default ProjectDataTab;
