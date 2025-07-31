import React, { useState } from 'react';
import CountrySelector from './CountrySelector';
import { ProjectData } from '../../types/project';
import './ProjectDataForm.css';

interface Props {
  onChange?: (data: ProjectData) => void;
  initialValues?: ProjectData;
}

const ProjectDataForm: React.FC<Props> = ({ onChange, initialValues }) => {
  const [formData, setFormData] = useState<ProjectData>(
    initialValues || {
      title: '',
      crmCode: '',
      client: '',
      activity: '',
      startDate: '',
      endDate: '',
      businessManager: '',
      businessUnit: '',
      opsDomain: '',
      country: '',
      scope: 'local',
      additionalCountries: [],
      iqp: 1,
      segmentation: 'New Business',
      description: '',
    }
  );

  React.useEffect(() => {
    if (initialValues) {
      setFormData(initialValues);
    }
  }, [initialValues]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Only call onChange when formData actually changes
  React.useEffect(() => {
    if (onChange) onChange(formData);
  }, [formData, onChange]);



  return (
    <form className="project-data-form">
      <h2 className="form-title">Información del Proyecto</h2>

      {/* Grid principal */}
      <div className="project-form-grid">
        <div className="form-group">
          <label>Título *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Código CRM</label>
          <input
            type="text"
            name="crmCode"
            value={formData.crmCode}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Cliente</label>
          <input
            type="text"
            name="client"
            value={formData.client}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Fecha de Inicio</label>
          <input
            type="date"
            name="startDate"
            value={formData.startDate}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Fecha de Fin</label>
          <input
            type="date"
            name="endDate"
            value={formData.endDate}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Manager del Negocio</label>
          <input
            type="text"
            name="businessManager"
            value={formData.businessManager}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Unidad de Negocio</label>
          <input
            type="text"
            name="businessUnit"
            value={formData.businessUnit}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Dominio Operativo</label>
          <input
            type="text"
            name="opsDomain"
            value={formData.opsDomain}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Actividad</label>
          <input
            type="text"
            name="activity"
            value={formData.activity}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>País(es)</label>
          <CountrySelector
            selectedCountries={formData.additionalCountries || []}
            onChange={(countries) => {
              setFormData((prev) => ({ ...prev, additionalCountries: countries }));
            }}
            max={10}
          />
        </div>

        <div className="form-group">
          <label>Ámbito</label>
          <select
            name="scope"
            value={formData.scope}
            onChange={handleInputChange}
          >
            <option value="local">Local</option>
            <option value="transnational">Transnacional</option>
          </select>
        </div>

        <div className="form-group">
          <label>IQP</label>
          <input
            type="number"
            name="iqp"
            value={formData.iqp}
            onChange={handleInputChange}
            min={0}
          />
        </div>

        <div className="form-group">
          <label>Segmentación</label>
          <select
            name="segmentation"
            value={formData.segmentation}
            onChange={handleInputChange}
          >
            <option value="New Business">New Business</option>
            <option value="Existing Business">Existing Business</option>
          </select>
        </div>
      </div>

      {/* Descripción ocupa todo el ancho */}
      <div className="form-group full-width">
        <label>Descripción</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={4}
        />
      </div>


    </form>
  );
};

export default ProjectDataForm;
