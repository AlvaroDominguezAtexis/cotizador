import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { apiConfig } from '../../utils/apiConfig';
import './ProjectManagerSalaries.css';

interface ProjectManagerSalariesProps {
  projectId: number;
  countries: { id: string; name: string }[];
  iqp?: number;
}

export const ProjectManagerSalaries: React.FC<ProjectManagerSalariesProps> = ({ projectId, countries, iqp = 3 }) => {
  const [salaries, setSalaries] = useState<Record<string, number>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editedSalaries, setEditedSalaries] = useState<Record<string, string>>({});
  const [isCollapsed, setIsCollapsed] = useState(iqp === 1 || iqp === 2); // Colapsado por defecto para IQP 1-2

  // Load existing PM salaries
  useEffect(() => {


    const loadSalaries = async () => {
      try {
        console.log('Loading PM salaries for project:', projectId);
        
        const response = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-management-salary`), {
          ...apiConfig.defaultOptions
        });

        if (!response.ok) {
          const text = await response.text();
          console.error('Error response:', text);
          throw new Error(`Failed to fetch PM salaries: ${response.status} ${response.statusText}`);
        }

        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.error('Error parsing response:', e);
          throw new Error('Invalid response format from server');
        }

        const salariesMap: Record<string, number> = {};
        data.forEach((item: { country_id: string; management_yearly_salary: number | null }) => {
          if (item.management_yearly_salary !== null) {
            salariesMap[item.country_id] = item.management_yearly_salary;
          }
        });
        setSalaries(salariesMap);
      } catch (error) {
        console.error('Error loading PM salaries:', error);
      }
    };
    loadSalaries();
  }, [projectId]);

  const handleEdit = () => {
    const initialEdits: Record<string, string> = {};
    countries.forEach(country => {
      initialEdits[country.id] = salaries[country.id]?.toString() || '';
    });
    setEditedSalaries(initialEdits);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      // Prepare updates array for all edited salaries
      console.log('Saving salaries for project:', projectId);
      const updates = Object.entries(editedSalaries).map(([countryId, salary]) => ({
        country_id: countryId,
        management_yearly_salary: salary ? Number(salary) : 0
      }));

      console.log('Sending updates:', updates);
      const response = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-management-salary`), {
        ...apiConfig.defaultOptions,
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Error response:', text);
        throw new Error(`Failed to update salaries: ${response.status} ${response.statusText}`);
      }

      // Update local state with new values
      const newSalaries: Record<string, number> = {};
      Object.entries(editedSalaries).forEach(([countryId, salary]) => {
        newSalaries[countryId] = salary ? Number(salary) : 0;
      });
      setSalaries(newSalaries);
      setIsEditing(false);
      setEditedSalaries({});
      
      // Reload data to ensure we have the latest values
      loadSalaries();
    } catch (error) {
      console.error('Error saving PM salaries:', error);
      alert('Error al guardar los salarios: ' + (error as Error).message);
    }
  };

  const loadSalaries = async () => {
    try {
      const response = await fetch(apiConfig.url(`/api/projects/${projectId}/countries-management-salary`), {
        ...apiConfig.defaultOptions
      });
      if (!response.ok) throw new Error('Failed to fetch PM salaries');
      const data = await response.json();
      const salariesMap: Record<string, number> = {};
      data.forEach((item: { country_id: string; management_yearly_salary: number | null }) => {
        if (item.management_yearly_salary !== null) {
          salariesMap[item.country_id] = item.management_yearly_salary;
        }
      });
      setSalaries(salariesMap);
    } catch (error) {
      console.error('Error loading PM salaries:', error);
      alert('Error al cargar los salarios: ' + (error as Error).message);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedSalaries({});
  };

  return (
    <div className="project-manager-salaries">
      <div className="profile-section-header">
        <div className="section-title-container">
          <h3>Project Manager Salaries</h3>
          <button 
            className="collapse-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        </div>
        {!isCollapsed && (
          isEditing ? (
            <div className="button-group">
              <Button variant="warning" size="sm" onClick={handleSave}>
                Guardar
              </Button>
              <Button variant="secondary" size="sm" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" onClick={handleEdit}>
              Editar
            </Button>
          )
        )}
      </div>
      
      {!isCollapsed && (
        <>
          {(iqp === 1 || iqp === 2) && (
            <div className="iqp-warning">
              <strong>⚠️ Warning:</strong> By default, management is 0% as IQP {iqp}. Please, modify this parameter in Workpackages to include management costs.
            </div>
          )}
          <div className="pm-salaries-grid">
            {countries.map(country => (
              <div key={country.id} className="pm-salary-item">
                <label>{country.name}</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSalaries[country.id] || ''}
                    onChange={(e) => setEditedSalaries(prev => ({
                      ...prev,
                      [country.id]: e.target.value
                    }))}
                    className="salary-input"
                    placeholder="Enter salary"
                  />
                ) : (
                  <div className="salary-display">
                    {salaries[country.id] ? `${Number(salaries[country.id]).toLocaleString()}€` : '-'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
