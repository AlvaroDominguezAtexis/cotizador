import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
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
        const response = await fetch(`/api/projects/${projectId}/countries-management`, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
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
      // Save each country salary individually
      console.log('Saving salaries for project:', projectId);
      const savePromises = Object.entries(editedSalaries).map(async ([countryId, salary]) => {
        console.log(`Saving salary for country ${countryId}:`, salary);
        const response = await fetch(`/api/projects/${projectId}/countries-management/${countryId}`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            management_yearly_salary: salary ? Number(salary) : 0
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          console.error(`Error response for country ${countryId}:`, text);
          throw new Error(`Failed to update salary for country ${countryId}`);
        }

        return response;
      });

      const responses = await Promise.all(savePromises);

      // Check for failed requests and collect error messages
      const errors: string[] = [];
      await Promise.all(
        responses.map(async (response, index) => {
          if (!response.ok) {
            const errorData = await response.json();
            errors.push(errorData.error || 'Error updating salary');
          }
        })
      );

      if (errors.length > 0) {
        throw new Error(`Failed to update salaries: ${errors.join(', ')}`);
      }

      // Update local state with new values
      const newSalaries: Record<string, number> = {};
      Object.entries(editedSalaries).forEach(([countryId, salary]) => {
        newSalaries[countryId] = salary ? Number(salary) : 0;
      });
      setSalaries(newSalaries);
      setIsEditing(false);
      
      // Reload data to ensure we have the latest values
      loadSalaries();
    } catch (error) {
      console.error('Error saving PM salaries:', error);
      alert('Error al guardar los salarios: ' + (error as Error).message);
    }
  };

  const loadSalaries = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/countries-management`);
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
